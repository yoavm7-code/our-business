import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // negative = expense (for installments = the payment made, e.g. -650)
  categorySlug?: string;
  totalAmount?: number; // for installments: full price (e.g. 1950)
  installmentCurrent?: number; // e.g. 2 (payment 2 of 3)
  installmentTotal?: number; // e.g. 3
}

/**
 * AI extraction: parse OCR text into structured transactions using OpenAI.
 */
@Injectable()
export class AiExtractService {
  private openai: OpenAI | null = null;

  private getClient(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  async extractTransactions(
    ocrText: string,
    userContext?: string,
  ): Promise<ExtractedTransaction[]> {
    const client = this.getClient();
    if (!client) {
      return this.fallbackExtract(ocrText);
    }
    const system = `You extract transactions from Israeli credit card/bank statement OCR text.

RULES (strict):
1) DATE - Each TRANSACTION ROW has its own charge date. Find the date IN THAT ROW only (format DD/MM/YY or DD.MM.YY, e.g. 28/01/26). Convert to YYYY-MM-DD (2026-01-28). IGNORE dates from page headers, filters, or "מ-... עד" (date range). If a row has no date, use the date from the PREVIOUS transaction row. Never use a single fixed date for all rows.

2) AMOUNT and INCOME vs EXPENSE - Use your judgment; it is usually intuitive. Extract both EXPENSES and INCOME. The number is in ILS, NOT part of the date. Use currency format XX.XX or XXX.XX.
• EXPENSE (return NEGATIVE): חיוב, הוצאה, משיכה, תשלום, or when the row is clearly a charge (e.g. merchant payment). In many statements there is no minus sign – expenses appear in RED or in a "חיוב" column, and income in GREEN or "זיכוי". Use that visual/context cue: red or charge column → negative; green or credit column → positive.
• INCOME (return POSITIVE): זיכוי, הפקדה, משכורת, החזר, הכנסה, or when the row is clearly a credit/deposit. When in doubt, consider layout (red vs green), column headers (חיוב vs זיכוי), and common sense (salary, refund = positive; store payment = negative).
For INSTALLMENTS: "650.00 מתוך 1,950.00" and "2 מתוך 3" – amount = payment made (650, negative), totalAmount = 1950, installmentCurrent = 2, installmentTotal = 3.

3) DESCRIPTION - The merchant/business name (בית עסק). Copy the Hebrew text exactly as it appears. Do not fix OCR errors. Keep Hebrew characters as-is.

4) CATEGORY - Use your judgment for every transaction and assign a category that best fits. You MUST set categorySlug for every transaction. Use exactly one of these slugs (lowercase): groceries, transport, utilities, rent, insurance, healthcare, dining, shopping, entertainment, salary, other. For INCOME use salary or other. For expenses: ביטוח → insurance, פיצה/מסעדה → dining, סופרמרקט → groceries, דלק/חניה → transport, חשבונות → utilities, קניות → shopping, בריאות → healthcare, בידור → entertainment. Use "other" only if nothing fits. If the user provided "User preferences" below, PREFER those categorizations when the description matches.

Output: JSON object with key "transactions": array of { date, description, amount (NEGATIVE for expenses, POSITIVE for income), categorySlug, totalAmount (optional), installmentCurrent (optional), installmentTotal (optional) }. For installments, amount = single payment (650), totalAmount = full price (1950). Skip rows you cannot parse.`;

    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      let userContent = `Extract transactions from this text:\n\n${ocrText.slice(0, 12000)}`;
      if (userContext?.trim()) {
        userContent += `\n\n---\nUser preferences and history (use when categorizing or deciding income vs expense):\n${userContext.trim().slice(0, 2000)}`;
      }
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) return this.fallbackExtract(ocrText);
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed.transactions) ? parsed.transactions : Array.isArray(parsed) ? parsed : [];
      const today = new Date().toISOString().slice(0, 10);
      const validSlugs = new Set(['groceries', 'transport', 'utilities', 'rent', 'insurance', 'healthcare', 'dining', 'shopping', 'entertainment', 'other', 'salary']);
      const mapped = list.map((t: Record<string, unknown>) => {
        let date = String(t.date || '').trim();
        if (!date || date === today) date = today;
        let amount = Number(t.amount) || 0;
        if (amount !== 0) amount = amount > 0 ? Math.abs(amount) : -Math.abs(amount);
        const slug = t.categorySlug ? String(t.categorySlug).toLowerCase() : undefined;
        const totalAmount = t.totalAmount != null ? Number(t.totalAmount) : undefined;
        const installmentCurrent = t.installmentCurrent != null ? Math.max(1, Math.floor(Number(t.installmentCurrent))) : undefined;
        const installmentTotal = t.installmentTotal != null ? Math.max(1, Math.floor(Number(t.installmentTotal))) : undefined;
        return {
          date,
          description: String(t.description || '').trim().slice(0, 300),
          amount,
          categorySlug: slug && validSlugs.has(slug) ? slug : 'other',
          ...(totalAmount != null && totalAmount > 0 && { totalAmount }),
          ...(installmentCurrent != null && { installmentCurrent }),
          ...(installmentTotal != null && { installmentTotal }),
        };
      });
      return this.fixInstallmentAmounts(mapped).filter((t: ExtractedTransaction) => Math.abs(t.amount) >= 5);
    } catch {
      return this.fallbackExtract(ocrText);
    }
  }

  /** If amount was wrongly set to total (full price), replace with the actual payment: totalAmount / installmentTotal. */
  private fixInstallmentAmounts(items: ExtractedTransaction[]): ExtractedTransaction[] {
    return items.map((t) => {
      const total = t.totalAmount;
      const totalPayments = t.installmentTotal;
      if (total == null || total <= 0 || totalPayments == null || totalPayments < 1) return t;
      const absAmount = Math.abs(t.amount);
      if (absAmount < total * 0.99) return t; // amount is already the payment, not the total
      const paymentPerInstallment = Math.round((total / totalPayments) * 100) / 100;
      return { ...t, amount: -paymentPerInstallment };
    });
  }

  /** Regex-based fallback: extract date and amount per line. For installments (X מתוך Y), amount = X (payment made), totalAmount = Y. */
  private fallbackExtract(ocrText: string): ExtractedTransaction[] {
    const lines = ocrText.split(/\n/).filter((l) => l.trim().length > 0);
    const today = new Date().toISOString().slice(0, 10);
    const results: ExtractedTransaction[] = [];
    const dateRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/;
    const amountPattern = /\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?/g;
    const mitochRe = /(\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?)\s*מתוך\s*(\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?)/g;
    const installmentNumRe = /(\d+)\s*מתוך\s*(\d+)/g;
    let lastDate = today;

    for (const line of lines) {
      const dateMatch = line.match(dateRe);
      if (dateMatch) {
        const [, d, m, y] = dateMatch;
        const year = y!.length === 2 ? `20${y}` : y;
        lastDate = `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
      }

      const lineWithoutDate = line.replace(dateRe, ' ');
      let amount = 0;
      let totalAmount: number | undefined;
      let installmentCurrent: number | undefined;
      let installmentTotal: number | undefined;

      const mitochMoney = [...lineWithoutDate.matchAll(mitochRe)];
      const mitochNum = [...line.matchAll(installmentNumRe)];

      // Only treat "X מתוך Y" as MONEY when at least one number looks like a price (decimals or > 100).
      // Otherwise "2 מתוך 3" (installment 2 of 3) would be wrongly used as amount=2, totalAmount=3.
      if (mitochMoney.length >= 1) {
        const pairs = mitochMoney.map((m) => [parseFloat(m[1].replace(/,/g, '')), parseFloat(m[2].replace(/,/g, ''))] as [number, number]);
        const looksLikePrice = (n: number) => n > 100 || (n !== Math.floor(n));
        const currencyLike = pairs.filter(
          ([a, b]) =>
            (looksLikePrice(a) || looksLikePrice(b)) &&
            a >= 0.01 &&
            a <= 100000 &&
            b >= 0.01 &&
            b <= 100000,
        );
        if (currencyLike.length > 0) {
          const [pay, total] = currencyLike[0];
          amount = Math.min(pay, total);
          totalAmount = Math.max(pay, total);
        }
      }
      if (mitochNum.length >= 1) {
        const nums = mitochNum.map((m) => [parseInt(m[1], 10), parseInt(m[2], 10)] as [number, number]);
        const valid = nums.filter(([a, b]) => a >= 1 && a <= b && b <= 120); // current <= total, e.g. 2/3 not 3/1
        if (valid.length > 0) {
          const [cur, tot] = valid[0];
          installmentCurrent = cur;
          installmentTotal = tot;
        }
      }

      if (amount <= 0) {
        const amountMatches = lineWithoutDate.match(amountPattern) || [];
        const withDecimals = amountMatches.filter((s) => /\.\d{2}$/.test(s) || /,\d{2}$/.test(s));
        let candidates = (withDecimals.length > 0 ? withDecimals : amountMatches)
          .map((s) => parseFloat(s.replace(/,/g, '')))
          .filter((n) => n >= 0.01 && n <= 100000);
        // For installments, avoid using small integers (2, 9, 4) as amount – they're often installment numbers.
        if (line.includes('מתוך') && candidates.length > 1) {
          const priceLike = candidates.filter((n) => n > 100 || n !== Math.floor(n));
          if (priceLike.length > 0) candidates = priceLike;
        }
        amount = candidates.length > 0 ? (line.includes('מתוך') ? Math.min(...candidates) : Math.max(...candidates)) : 0;
      }
      if (amount <= 0) continue;

      const desc = line
        .replace(dateRe, ' ')
        .replace(amountPattern, ' ')
        .replace(mitochRe, ' ')
        .replace(installmentNumRe, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || 'Unknown';

      results.push({
        date: lastDate,
        description: desc,
        amount: -Math.abs(amount),
        categorySlug: 'other',
        ...(totalAmount != null && { totalAmount }),
        ...(installmentCurrent != null && { installmentCurrent }),
        ...(installmentTotal != null && { installmentTotal }),
      });
    }
    return this.fixInstallmentAmounts(results);
  }
}
