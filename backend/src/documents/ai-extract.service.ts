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

/** Sign hint from layout/keywords – used to force correct income vs expense. */
export type SignHint = 'income' | 'expense' | 'unknown';

/** Per-line sign hints from deterministic preprocessor (layout + Hebrew keywords). */
export interface SignHints {
  /** Line index in original text (or logical row) → suggested sign for that row's amount(s). */
  byLine: Map<number, SignHint>;
  /** When a line has TWO amounts: [incomeAmount, expenseAmount] – so we can assign sign by position. */
  twoAmountsByLine: Map<number, { income: number; expense: number }>;
}

// Hebrew keywords: income vs expense (substring match, case-sensitive for Hebrew)
const INCOME_KEYWORDS = [
  'משכורת', 'זיכוי', 'הכנסה', 'הפקדה', 'החזר', 'קצבה', 'קצבת', 'ביטוח לאומי', 'העברה-נייד',
  'הוראת-קבע', 'פרימיום', 'העברת כסף', 'bit ', 'BIT ', 'בטוח לאומי', 'ביטוח לאומי ג', 'ביטוח לאומי חד',
  'פמי פרימיום', 'פמי פרימיום בע', 'מ.א.', 'מ.א ', 'אפרויה', 'אפרויה בע',
];
const EXPENSE_KEYWORDS = [
  'חיוב', 'חיובי', 'משיכה', 'תשלום', 'העב\' לאחר', 'העברה לאחר', 'העב\' לאחר-נייד', 'לאחר-נייד',
  'עמ\'הקצאת אשראי', 'עם הקצאת אשראי', 'הקצאת אשראי', 'כאל', 'מקס איט פיננסי', 'לאומי קארד', 'CAL', 'דמי ניהול',
  'On איט פיננסי', 'שיק', 'מקס איט',
];

/**
 * AI extraction: parse OCR text into structured transactions using OpenAI.
 * Uses a deterministic preprocessor (layout + Hebrew keywords) to fix income vs expense before/after AI.
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

  /**
   * Deterministic sign hints from layout and keywords.
   * Israeli bank convention: two amount columns per row → first column = income (green), second = expense (red).
   */
  getSignHints(ocrText: string): SignHints {
    const byLine = new Map<number, SignHint>();
    const twoAmountsByLine = new Map<number, { income: number; expense: number }>();
    const lines = ocrText.split(/\n/).filter((l) => l.trim().length > 0);
    const dateRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/;
    const amountPattern = /\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineWithoutDate = line.replace(dateRe, ' ');
      const amountStrs = lineWithoutDate.match(amountPattern) || [];
      const amounts = amountStrs
        .map((s) => parseFloat(s.replace(/,/g, '')))
        .filter((n) => n >= 0.01 && n <= 100000);
      const priceLike = amounts.filter((n) => n > 100 || (n !== Math.floor(n)));
      const candidates = priceLike.length >= 1 ? priceLike : amounts;

      if (candidates.length >= 2) {
        // Two amounts on line → Israeli convention: usually first = income (green), second = expense (red).
        // If line has only expense keywords (e.g. RTL: expense column read first), swap.
        const desc = line.replace(dateRe, ' ').replace(amountPattern, ' ').replace(/\s+/g, ' ').trim();
        const hasIncome = INCOME_KEYWORDS.some((k) => desc.includes(k));
        const hasExpense = EXPENSE_KEYWORDS.some((k) => desc.includes(k));
        let income = candidates[0];
        let expense = candidates[1];
        if (!hasIncome && hasExpense) {
          income = candidates[1];
          expense = candidates[0];
        }
        twoAmountsByLine.set(i, { income, expense });
        byLine.set(i, 'unknown');
        continue;
      }

      if (candidates.length === 1) {
        const desc = line.replace(dateRe, ' ').replace(amountPattern, ' ').replace(/\s+/g, ' ').trim();
        const hasIncome = INCOME_KEYWORDS.some((k) => desc.includes(k));
        const hasExpense = EXPENSE_KEYWORDS.some((k) => desc.includes(k));
        if (hasIncome && !hasExpense) byLine.set(i, 'income');
        else if (hasExpense && !hasIncome) byLine.set(i, 'expense');
        else byLine.set(i, 'unknown');
      }
    }
    return { byLine, twoAmountsByLine };
  }

  /**
   * Build annotated text for AI: add [INCOME_AMT=X] [EXPENSE_AMT=Y] or [SIGN=INCOME/EXPENSE/UNKNOWN] per line
   * so the model does not have to guess from "green/red" (which it cannot see in plain text).
   */
  private buildAnnotatedText(ocrText: string, hints: SignHints): string {
    const lines = ocrText.split(/\n/).filter((l) => l.trim().length > 0);
    const dateRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/;
    const amountPattern = /\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?/g;
    const out: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const two = hints.twoAmountsByLine.get(i);
      const signHint = hints.byLine.get(i);

      if (two) {
        const prefix = `[INCOME_AMT=${two.income}] [EXPENSE_AMT=${two.expense}]`;
        out.push(`${prefix} | ${line}`);
        continue;
      }
      const lineWithoutDate = line.replace(dateRe, ' ');
      const amountStrs = lineWithoutDate.match(amountPattern) || [];
      const amounts = amountStrs.map((s) => parseFloat(s.replace(/,/g, ''))).filter((n) => n >= 0.01 && n <= 100000);
      const priceLike = amounts.filter((n) => n > 100 || n !== Math.floor(n));
      const cand = priceLike.length >= 1 ? priceLike : amounts;
      if (cand.length === 1) {
        const sign = signHint === 'income' ? 'INCOME' : signHint === 'expense' ? 'EXPENSE' : 'UNKNOWN';
        out.push(`[SIGN=${sign} AMT=${cand[0]}] | ${line}`);
      } else {
        out.push(line);
      }
    }
    return out.join('\n');
  }

  async extractTransactions(
    ocrText: string,
    userContext?: string,
  ): Promise<ExtractedTransaction[]> {
    const hints = this.getSignHints(ocrText);
    const annotated = this.buildAnnotatedText(ocrText, hints);

    const client = this.getClient();
    if (!client) {
      return this.fallbackExtractWithHints(ocrText, hints);
    }

    const system = `You extract transactions from Israeli bank/credit statement text.

CRITICAL – WE PRE-ANNOTATED EACH ROW WITH SIGN. USE IT STRICTLY.
• [INCOME_AMT=X] [EXPENSE_AMT=Y] on a row: output TWO transactions – one with amount +X (income), one with amount -Y (expense). Use the same date and appropriate description for each.
• [SIGN=INCOME AMT=X]: output ONE transaction with amount +X (positive = income). Never make it negative.
• [SIGN=EXPENSE AMT=X]: output ONE transaction with amount -X (negative = expense). Never make it positive.
• [SIGN=UNKNOWN AMT=X]: infer from description: salary/משכורת, deposit/הפקדה, refund/החזר, credit/זיכוי, ביטוח לאומי, העברה-נייד (incoming) → POSITIVE. Charge/חיוב, payment/תשלום, העב' לאחר → NEGATIVE.
Do NOT override our INCOME/EXPENSE annotations. If we marked INCOME, the amount must be positive.

1) DATE – In each row use the date in that row (DD/MM/YY or DD.MM.YY). Convert to YYYY-MM-DD. If no date, use previous row's date.

2) DESCRIPTION – Copy Hebrew EXACTLY. Preserve מ.א, בע"מ, ע"א. Never output Latin letters (a-z, A-Z) in description – if OCR produced Latin, replace with Hebrew (e.g. xn→מ.א) or remove it.

3) CATEGORY – One of: groceries, transport, utilities, rent, insurance, healthcare, dining, shopping, entertainment, salary, credit_charges, other. Income → salary or other. credit_charges = כאל, מקס איט פיננסי, לאומי קארד, etc.

4) INSTALLMENTS – "X מתוך Y" (money) and "N מתוך M" (payment index): amount = X (single payment, negative), totalAmount = Y, installmentCurrent = N, installmentTotal = M.

5) COMPLETENESS – Extract EVERY row that has a date and at least one amount. Do NOT skip small amounts (e.g. 12.00, 12). Include all transactions. Missing even one row is a critical error.

6) DESCRIPTION – Output ONLY Hebrew letters, digits, and punctuation. Never put Latin letters (a-z, A-Z) in the description. If the source has Latin/gibberish (e.g. "xn fe"), replace with the correct Hebrew (e.g. "מ.א") or remove the Latin part. Copy Hebrew exactly: מ.א, בע"מ, ע"א.

Output: JSON with key "transactions": array of { date, description, amount (POSITIVE=income, NEGATIVE=expense), categorySlug, totalAmount?, installmentCurrent?, installmentTotal? }. Include every parseable row.`;

    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      let userContent = `Extract transactions. Each row is pre-annotated with [INCOME_AMT]/[EXPENSE_AMT] or [SIGN=... AMT=...]. Use these signs exactly.\n\n${annotated.slice(0, 14000)}`;
      if (userContext?.trim()) {
        userContent += `\n\n---\nUser preferences (if a description was categorized as "salary", use categorySlug "salary" and POSITIVE amount):\n${userContext.trim().slice(0, 2000)}`;
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
      if (!content) return this.fallbackExtractWithHints(ocrText, hints);
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed.transactions) ? parsed.transactions : Array.isArray(parsed) ? parsed : [];
      const today = new Date().toISOString().slice(0, 10);
      const validSlugs = new Set(['groceries', 'transport', 'utilities', 'rent', 'insurance', 'healthcare', 'dining', 'shopping', 'entertainment', 'other', 'salary', 'credit_charges']);
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
      const fixed = this.applySignHintsOverlay(mapped, ocrText, hints);
      const withCleanDesc = fixed.map((t) => ({ ...t, description: this.sanitizeDescription(t.description) }));
      return this.fixInstallmentAmounts(withCleanDesc).filter((t: ExtractedTransaction) => Math.abs(t.amount) >= 0.01);
    } catch {
      return this.fallbackExtractWithHints(ocrText, hints);
    }
  }

  /**
   * Remove or fix OCR gibberish in description: Latin letters that shouldn't be there, common misreads.
   */
  private sanitizeDescription(desc: string): string {
    if (!desc || !desc.trim()) return desc;
    let s = desc.trim();
    // Common OCR errors: Latin in place of Hebrew (no \b – Hebrew has no word boundaries)
    s = s.replace(/xn\s*fe/gi, 'מ.א');
    s = s.replace(/mawn\s*BE-?/gi, 'העברה-נייד').replace(/THANK\?\s*wn\s*\d*/gi, "העב' לאחר-נייד");
    // Strip remaining Latin word sequences (2+ letters) so description is Hebrew-only
    s = s.replace(/\s*[a-zA-Z]{2,}(?:\s+[a-zA-Z]*)*\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return s.slice(0, 300);
  }

  /**
   * Overlay sign hints on AI output: for each transaction, if we have a strong hint (income/expense from
   * two-column layout or keyword), force the sign so we never end up with salary as expense.
   */
  private applySignHintsOverlay(
    transactions: ExtractedTransaction[],
    ocrText: string,
    hints: SignHints,
  ): ExtractedTransaction[] {
    const lines = ocrText.split(/\n/).filter((l) => l.trim().length > 0);
    const dateRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/;
    const amountPattern = /\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?/g;
    let lastDate = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(dateRe);
      if (dateMatch) {
        const [, d, m, y] = dateMatch;
        const year = (y!.length === 2 ? `20${y}` : y!) as string;
        lastDate = `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
      }

      const two = hints.twoAmountsByLine.get(i);
      const signHint = hints.byLine.get(i);
      if (two) {
        for (const t of transactions) {
          const abs = Math.abs(t.amount);
          if (Math.abs(abs - two.income) < 0.02 && t.amount < 0) t.amount = two.income;
          if (Math.abs(abs - two.expense) < 0.02 && t.amount > 0) t.amount = -two.expense;
        }
        continue;
      }
      if ((signHint === 'income' || signHint === 'expense') && lastDate) {
        const lineWithoutDate = line.replace(dateRe, ' ');
        const amountStrs = lineWithoutDate.match(amountPattern) || [];
        const amounts = amountStrs.map((s) => parseFloat(s.replace(/,/g, ''))).filter((n) => n >= 0.01 && n <= 100000);
        const priceLike = amounts.filter((n) => n > 100 || n !== Math.floor(n));
        const cand = priceLike.length >= 1 ? priceLike : amounts;
        if (cand.length === 1) {
          const expectedAbs = cand[0];
          const wrongSign = signHint === 'income' ? (t: ExtractedTransaction) => t.amount < 0 : (t: ExtractedTransaction) => t.amount > 0;
          const fix = signHint === 'income' ? (t: ExtractedTransaction) => { t.amount = expectedAbs; } : (t: ExtractedTransaction) => { t.amount = -expectedAbs; };
          const idx = transactions.findIndex((t) => t.date === lastDate && Math.abs(Math.abs(t.amount) - expectedAbs) < 0.02 && wrongSign(t));
          if (idx >= 0) fix(transactions[idx]);
        }
      }
    }
    return transactions;
  }

  /** Fallback extraction using only layout + keywords (no AI). */
  private fallbackExtractWithHints(ocrText: string, hints: SignHints): ExtractedTransaction[] {
    const lines = ocrText.split(/\n/).filter((l) => l.trim().length > 0);
    const dateRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/;
    const amountPattern = /\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?/g;
    const today = new Date().toISOString().slice(0, 10);
    const results: ExtractedTransaction[] = [];
    let lastDate = today;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(dateRe);
      if (dateMatch) {
        const [, d, m, y] = dateMatch;
        const year = (y!.length === 2 ? `20${y}` : y!) as string;
        lastDate = `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
      }

      const two = hints.twoAmountsByLine.get(i);
      if (two) {
        if (two.income >= 0.01) {
          const rawDesc = line.replace(dateRe, ' ').replace(amountPattern, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Unknown';
          results.push({ date: lastDate, description: this.sanitizeDescription(rawDesc), amount: two.income, categorySlug: 'other' });
        }
        if (two.expense >= 0.01) {
          const rawDesc = line.replace(dateRe, ' ').replace(amountPattern, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Unknown';
          results.push({ date: lastDate, description: this.sanitizeDescription(rawDesc), amount: -two.expense, categorySlug: 'other' });
        }
        continue;
      }

      const signHint = hints.byLine.get(i);
      const lineWithoutDate = line.replace(dateRe, ' ');
      const amountStrs = lineWithoutDate.match(amountPattern) || [];
      const amounts = amountStrs.map((s) => parseFloat(s.replace(/,/g, ''))).filter((n) => n >= 0.01 && n <= 100000);
      const priceLike = amounts.filter((n) => n > 100 || n !== Math.floor(n));
      const cand = priceLike.length >= 1 ? priceLike : amounts;
      if (cand.length === 0) continue;
      const amount = Math.max(...cand);

      const rawDesc = line.replace(dateRe, ' ').replace(amountPattern, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Unknown';
      const sign = signHint === 'income' ? 1 : signHint === 'expense' ? -1 : -1; // unknown default expense
      results.push({ date: lastDate, description: this.sanitizeDescription(rawDesc), amount: sign * amount, categorySlug: 'other' });
    }
    return this.fixInstallmentAmounts(results);
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
