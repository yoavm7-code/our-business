import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

export interface ParsedVoiceTransaction {
  type: 'expense' | 'income';
  amount: number;
  description: string;
  categorySlug: string | null;
  date: string; // YYYY-MM-DD
  currency: string;
}

// Simple keyword → category mapping for fallback parser
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: ['סופר', 'מכולת', 'ירקות', 'פירות', 'מזון', 'שוק', 'grocery', 'supermarket'],
  dining: ['מסעדה', 'קפה', 'אוכל', 'פיצה', 'המבורגר', 'סושי', 'ארוחה', 'בית קפה', 'restaurant', 'coffee', 'food', 'cafe'],
  transport: ['דלק', 'בנזין', 'רכבת', 'אוטובוס', 'מונית', 'חניה', 'fuel', 'gas', 'taxi', 'bus', 'train', 'parking'],
  utilities: ['חשמל', 'מים', 'גז', 'ארנונה', 'electricity', 'water', 'gas'],
  healthcare: ['רופא', 'תרופות', 'בית חולים', 'רפואה', 'מרפאה', 'doctor', 'medicine', 'pharmacy'],
  shopping: ['בגדים', 'נעליים', 'ביגוד', 'קניות', 'clothes', 'shoes', 'shopping'],
  entertainment: ['סרט', 'קולנוע', 'הופעה', 'הצגה', 'בילוי', 'movie', 'show', 'concert'],
  subscriptions: ['מנוי', 'נטפליקס', 'ספוטיפיי', 'subscription', 'netflix', 'spotify'],
  education: ['לימודים', 'קורס', 'ספרים', 'course', 'books', 'education'],
  rent: ['שכירות', 'דירה', 'rent', 'apartment'],
  insurance: ['ביטוח', 'insurance'],
  salary: ['משכורת', 'שכר', 'salary', 'wage'],
  income: ['הכנסה', 'income', 'revenue'],
};

@Injectable()
export class VoiceParserService {
  private readonly logger = new Logger(VoiceParserService.name);
  private openai: OpenAI | null = null;

  constructor(private prisma: PrismaService) {}

  private getClient(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  /**
   * Regex-based fallback parser for common Hebrew/English patterns.
   * Handles simple cases without needing the OpenAI API.
   */
  private fallbackParse(
    text: string,
    categorySlugs: string[],
  ): ParsedVoiceTransaction | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const today = new Date().toISOString().slice(0, 10);
    let type: 'expense' | 'income' = 'expense';
    let amount: number | null = null;
    let description = '';
    let currency = 'ILS';

    // Detect currency
    if (/דולר|dollars?|\$|usd/i.test(trimmed)) currency = 'USD';
    else if (/יורו|euros?|eur/i.test(trimmed)) currency = 'EUR';

    // Detect date
    let date = today;
    if (/אתמול|yesterday/i.test(trimmed)) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      date = d.toISOString().slice(0, 10);
    } else if (/שלשום|day before yesterday/i.test(trimmed)) {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      date = d.toISOString().slice(0, 10);
    }

    // Income patterns
    const incomePatterns = [
      // "קיבלתי X שקל מ-Y" / "קיבלתי משכורת X"
      /(?:קיבלתי|הכנסה|received|got)\s+(?:משכורת\s+|שכר\s+)?(\d[\d,.]*)\s*(?:שקל|ש"ח|₪)?(?:\s+(?:מ|על|עבור)\s*(.+))?/i,
      /(?:קיבלתי|הכנסה|received|got)\s+(.+?)\s+(\d[\d,.]*)/i,
      // "משכורת X"
      /(?:משכורת|שכר|salary)\s+(\d[\d,.]*)/i,
    ];

    for (const pattern of incomePatterns) {
      const m = trimmed.match(pattern);
      if (m) {
        type = 'income';
        if (pattern === incomePatterns[2]) {
          // "משכורת X" pattern
          amount = parseFloat(m[1].replace(/,/g, ''));
          description = 'משכורת';
        } else if (pattern === incomePatterns[1]) {
          // "קיבלתי Y X"
          description = m[1].trim();
          amount = parseFloat(m[2].replace(/,/g, ''));
        } else {
          amount = parseFloat(m[1].replace(/,/g, ''));
          description = m[2]?.trim() || 'הכנסה';
        }
        break;
      }
    }

    // Expense patterns (only if income not matched)
    if (type !== 'income' || !amount) {
      type = 'expense';
      const expensePatterns = [
        // "הוצאתי X שקל על Y"
        /(?:הוצאתי|שילמתי|paid|spent)\s+(\d[\d,.]*)\s*(?:שקל|ש"ח|₪|דולר|יורו)?\s+(?:על|ל|עבור|ב)\s*(.+)/i,
        // "הוצאה X שקל Y"
        /(?:הוצאה|expense)\s+(\d[\d,.]*)\s*(?:שקל|ש"ח|₪|דולר|יורו)?\s+(.+)/i,
        // "קניתי Y ב-X שקל"
        /(?:קניתי|bought)\s+(.+?)\s+(?:ב|ב-)?\s*(\d[\d,.]*)\s*(?:שקל|ש"ח|₪|דולר|יורו)?/i,
        // "X שקל על Y" (simple)
        /(\d[\d,.]*)\s*(?:שקל|ש"ח|₪|דולר|יורו)\s+(?:על|ל|עבור|ב)\s*(.+)/i,
        // "הוצאתי/שילמתי X על Y" (without currency word)
        /(?:הוצאתי|שילמתי|paid|spent)\s+(\d[\d,.]*)\s+(?:על|ל|עבור|ב)\s*(.+)/i,
      ];

      for (const pattern of expensePatterns) {
        const m = trimmed.match(pattern);
        if (m) {
          if (pattern === expensePatterns[2]) {
            // "קניתי Y ב-X" - description first, amount second
            description = m[1].trim();
            amount = parseFloat(m[2].replace(/,/g, ''));
          } else {
            amount = parseFloat(m[1].replace(/,/g, ''));
            description = m[2].trim();
          }
          break;
        }
      }
    }

    // Last resort: try to find any number and use the rest as description
    if (!amount) {
      const numMatch = trimmed.match(/(\d[\d,.]*)/);
      if (numMatch) {
        amount = parseFloat(numMatch[1].replace(/,/g, ''));
        description = trimmed
          .replace(numMatch[0], '')
          .replace(/שקל|ש"ח|₪|דולר|יורו/g, '')
          .replace(/הוצאתי|שילמתי|קיבלתי|הוצאה|הכנסה|על|ב-?|ל-?|עבור/g, '')
          .trim();
        // Detect income keywords
        if (/קיבלתי|הכנסה|משכורת|שכר/i.test(trimmed)) {
          type = 'income';
        }
      }
    }

    if (!amount || amount <= 0 || !description) return null;

    // Clean description of currency/date words
    description = description
      .replace(/שקל|ש"ח|₪|דולר|יורו|אתמול|שלשום/g, '')
      .trim();

    if (!description) return null;

    // Match category
    const categorySlug = this.matchCategory(description, categorySlugs);

    return { type, amount, description, categorySlug, date, currency };
  }

  private matchCategory(
    description: string,
    availableSlugs: string[],
  ): string | null {
    const lower = description.toLowerCase();
    for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (!availableSlugs.includes(slug)) continue;
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) return slug;
      }
    }
    // If no keyword match but available slugs exist, try partial match on slug name
    for (const slug of availableSlugs) {
      if (lower.includes(slug)) return slug;
    }
    return null;
  }

  async parseVoiceText(
    householdId: string,
    text: string,
  ): Promise<ParsedVoiceTransaction | null> {
    // Fetch user's categories for context
    const cats = await this.prisma.category.findMany({
      where: { householdId },
      select: { slug: true, name: true, isIncome: true },
    });

    const categorySlugs = cats.map((c) => c.slug);
    const today = new Date().toISOString().slice(0, 10);

    // Try OpenAI first
    const client = this.getClient();
    if (client) {
      try {
        const result = await this.parseWithOpenAI(
          client,
          text,
          categorySlugs,
          today,
        );
        if (result) return result;
        this.logger.warn(
          'OpenAI returned empty/invalid result, falling back to regex parser',
        );
      } catch (err) {
        this.logger.error(
          'OpenAI voice parse failed, falling back to regex parser',
          err instanceof Error ? err.message : err,
        );
      }
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not set, using regex fallback parser',
      );
    }

    // Fallback: regex-based parser
    const fallback = this.fallbackParse(text, categorySlugs);
    if (fallback) {
      this.logger.log(`Fallback parser succeeded for: "${text}"`);
      return fallback;
    }

    this.logger.warn(`Both OpenAI and fallback parser failed for: "${text}"`);
    return null;
  }

  private async parseWithOpenAI(
    client: OpenAI,
    text: string,
    categorySlugs: string[],
    today: string,
  ): Promise<ParsedVoiceTransaction | null> {
    const slugList = categorySlugs.join(', ');

    const systemPrompt = `You are a financial transaction parser for a personal finance app.
The user speaks in Hebrew or English. Parse their voice input into a structured transaction.

Available category slugs: ${slugList || 'groceries, transport, utilities, rent, insurance, healthcare, dining, shopping, entertainment, salary, income, subscriptions, education, other'}

Rules:
- "type" must be "expense" or "income"
- "amount" must be a positive number
- "description" is a short description of the transaction
- "categorySlug" should match the most relevant category from the list above, or null if unsure
- "date" should be "${today}" unless the user specifies another date (e.g., "אתמול" = yesterday, "שלשום" = day before yesterday)
- "currency" is "ILS" by default, unless the user says dollars/דולר (USD), euros/יורו (EUR), etc.
- Hebrew examples: "הוצאתי 50 שקל על קפה" → expense, 50, "קפה", "dining"
- "קיבלתי משכורת 15000" → income, 15000, "משכורת", "salary"
- "שילמתי 200 על חשמל" → expense, 200, "חשמל", "utilities"
- "הוצאה 80 שקל סופר" → expense, 80, "סופר", "groceries"

Return ONLY valid JSON with this exact structure:
{"type":"expense","amount":50,"description":"קפה","categorySlug":"dining","date":"${today}","currency":"ILS"}`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Validate required fields
    if (!parsed.type || !parsed.amount || !parsed.description) return null;

    return {
      type: parsed.type === 'income' ? 'income' : 'expense',
      amount: Math.abs(Number(parsed.amount)),
      description: String(parsed.description),
      categorySlug: parsed.categorySlug || null,
      date: parsed.date || today,
      currency: parsed.currency || 'ILS',
    };
  }
}
