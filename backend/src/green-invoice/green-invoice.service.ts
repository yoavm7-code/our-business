import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Green Invoice API types ──────────────────────────
interface GreenInvoiceToken {
  token: string;
  expiresAt: number; // unix ms
}

interface GreenInvoiceDocument {
  id: string;
  number: number;
  type: number;
  status: number;
  lang: string;
  currency: string;
  amount: number;
  vat: number;
  vatType: number;
  discount: number;
  rounding: boolean;
  signed: boolean;
  description: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  payment: Array<{
    type: number;
    date: string;
    price: number;
    currency: string;
  }>;
  income: Array<{
    catalogNum: string;
    description: string;
    quantity: number;
    price: number;
    currency: string;
    vatType: number;
  }>;
  client: {
    id: string;
    name: string;
    emails: string[];
    taxId: string;
    address: string;
    city: string;
    country: string;
    phone: string;
  };
  url: {
    origin: string;
    he: string;
    en: string;
  };
}

interface GreenInvoiceSearchResult {
  items: GreenInvoiceDocument[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Document type mapping ────────────────────────────
const GI_DOC_TYPE_MAP: Record<number, string> = {
  10: 'PRICE_QUOTE',
  300: 'TAX_INVOICE', // proforma
  305: 'TAX_INVOICE',
  320: 'TAX_INVOICE_RECEIPT',
  330: 'CREDIT_NOTE',
  400: 'RECEIPT',
  200: 'DELIVERY_NOTE',
};

const LOCAL_TO_GI_TYPE: Record<string, number> = {
  TAX_INVOICE: 305,
  TAX_INVOICE_RECEIPT: 320,
  RECEIPT: 400,
  PRICE_QUOTE: 10,
  DELIVERY_NOTE: 200,
  CREDIT_NOTE: 330,
};

// ── Document status mapping ──────────────────────────
function giStatusToLocal(giStatus: number, giType: number): string {
  // 0=opened, 1=closed, 2=manually closed, 3=canceling, 4=cancelled
  if (giStatus === 4 || giStatus === 3) return 'CANCELLED';
  if (giStatus === 1 || giStatus === 2) {
    // Closed document - if it has payments, it's paid
    return 'PAID';
  }
  return 'SENT'; // opened = sent/pending
}

const PROD_BASE = 'https://api.greeninvoice.co.il/api/v1';
const SANDBOX_BASE = 'https://sandbox.d.greeninvoice.co.il/api/v1';

@Injectable()
export class GreenInvoiceService {
  private readonly logger = new Logger(GreenInvoiceService.name);
  // In-memory token cache per business
  private tokenCache = new Map<string, GreenInvoiceToken>();

  constructor(private prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────

  private getBaseUrl(sandbox: boolean): string {
    return sandbox ? SANDBOX_BASE : PROD_BASE;
  }

  private async getCredentials(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        greenInvoiceKeyId: true,
        greenInvoiceSecret: true,
        greenInvoiceSandbox: true,
      },
    });
    if (!biz?.greenInvoiceKeyId || !biz?.greenInvoiceSecret) {
      throw new BadRequestException('Green Invoice credentials not configured');
    }
    return {
      keyId: biz.greenInvoiceKeyId,
      secret: biz.greenInvoiceSecret,
      sandbox: biz.greenInvoiceSandbox,
    };
  }

  private async getToken(businessId: string): Promise<string> {
    // Check cache
    const cached = this.tokenCache.get(businessId);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }

    const creds = await this.getCredentials(businessId);
    const base = this.getBaseUrl(creds.sandbox);

    const res = await fetch(`${base}/account/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: creds.keyId, secret: creds.secret }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Green Invoice auth failed: ${res.status} ${text}`);
      throw new BadRequestException('Green Invoice authentication failed. Check your API credentials.');
    }

    const data = await res.json();
    const token = data.token as string;

    // Cache for 50 minutes (token lasts 60 min)
    this.tokenCache.set(businessId, {
      token,
      expiresAt: Date.now() + 50 * 60 * 1000,
    });

    return token;
  }

  private async apiRequest<T>(
    businessId: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getToken(businessId);
    const creds = await this.getCredentials(businessId);
    const base = this.getBaseUrl(creds.sandbox);

    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Green Invoice API error: ${method} ${path} → ${res.status} ${text}`);
      throw new BadRequestException(`Green Invoice API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Public API ─────────────────────────────────────

  /** Test the connection with stored credentials */
  async testConnection(businessId: string): Promise<{ success: boolean; businessName?: string }> {
    try {
      const token = await this.getToken(businessId);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /** Save Green Invoice credentials for a business */
  async saveCredentials(
    businessId: string,
    keyId: string,
    secret: string,
    sandbox: boolean,
  ) {
    // Clear cached token
    this.tokenCache.delete(businessId);

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        greenInvoiceKeyId: keyId,
        greenInvoiceSecret: secret,
        greenInvoiceSandbox: sandbox,
      },
    });

    // Test the connection
    return this.testConnection(businessId);
  }

  /** Remove Green Invoice credentials */
  async removeCredentials(businessId: string) {
    this.tokenCache.delete(businessId);
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        greenInvoiceKeyId: null,
        greenInvoiceSecret: null,
        greenInvoiceSandbox: false,
        greenInvoiceLastSync: null,
      },
    });
  }

  /** Check if credentials are configured */
  async getStatus(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        greenInvoiceKeyId: true,
        greenInvoiceSandbox: true,
        greenInvoiceLastSync: true,
      },
    });
    return {
      connected: !!biz?.greenInvoiceKeyId,
      sandbox: biz?.greenInvoiceSandbox ?? false,
      lastSync: biz?.greenInvoiceLastSync ?? null,
    };
  }

  /** Fetch recent documents from Green Invoice and import them */
  async syncDocuments(businessId: string, options?: { fromDate?: string; toDate?: string }) {
    const now = new Date();
    const fromDate = options?.fromDate || new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const toDate = options?.toDate || now.toISOString().slice(0, 10);

    // Fetch documents page by page
    let page = 0;
    let imported = 0;
    let skipped = 0;
    let total = 0;

    do {
      const result = await this.apiRequest<GreenInvoiceSearchResult>(
        businessId,
        'POST',
        '/documents/search',
        {
          page,
          pageSize: 50,
          sort: 'documentDate',
          direction: 'desc',
          fromDate,
          toDate,
          type: [305, 320, 400, 330, 10], // main document types
        },
      );

      total = result.total;

      for (const doc of result.items) {
        const wasImported = await this.importDocument(businessId, doc);
        if (wasImported) imported++;
        else skipped++;
      }

      page++;
    } while ((page * 50) < total && page < 20); // Safety: max 20 pages = 1000 docs

    // Update last sync timestamp
    await this.prisma.business.update({
      where: { id: businessId },
      data: { greenInvoiceLastSync: now },
    });

    return { imported, skipped, total };
  }

  /** Import a single Green Invoice document into local invoices */
  private async importDocument(businessId: string, doc: GreenInvoiceDocument): Promise<boolean> {
    // Check if already imported
    const existing = await this.prisma.invoice.findFirst({
      where: {
        businessId,
        externalId: doc.id,
        externalSource: 'greeninvoice',
      },
    });
    if (existing) return false;

    // Map document type
    const localType = GI_DOC_TYPE_MAP[doc.type] || 'TAX_INVOICE';
    const localStatus = giStatusToLocal(doc.status, doc.type);

    // Try to match client by name or tax ID
    let clientId: string | null = null;
    if (doc.client?.name) {
      const matchedClient = await this.prisma.client.findFirst({
        where: {
          businessId,
          OR: [
            { name: { contains: doc.client.name, mode: 'insensitive' } },
            ...(doc.client.taxId
              ? [{ taxId: doc.client.taxId }]
              : []),
          ],
        },
        select: { id: true },
      });
      clientId = matchedClient?.id || null;

      // Auto-create client if not found
      if (!clientId && doc.client.name) {
        const newClient = await this.prisma.client.create({
          data: {
            businessId,
            name: doc.client.name,
            email: doc.client.emails?.[0] || null,
            phone: doc.client.phone || null,
            taxId: doc.client.taxId || null,
            address: [doc.client.address, doc.client.city].filter(Boolean).join(', ') || null,
          },
        });
        clientId = newClient.id;
      }
    }

    // Calculate amounts
    const totalAmount = doc.amount || 0;
    const vatAmount = doc.vat || 0;
    const subtotal = totalAmount - vatAmount;
    const vatRate = subtotal > 0 ? Math.round((vatAmount / subtotal) * 100 * 100) / 100 : 17;

    // Generate next invoice number
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { businessId },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const nextNum = lastInvoice
      ? String(parseInt(lastInvoice.invoiceNumber, 10) + 1).padStart(4, '0')
      : '0001';

    // Determine issue date
    const issueDate = doc.createdAt ? new Date(doc.createdAt) : new Date();

    // Build payment date if paid
    const paidDate = localStatus === 'PAID' && doc.payment?.[0]?.date
      ? new Date(doc.payment[0].date)
      : localStatus === 'PAID'
      ? issueDate
      : null;

    // Create the invoice
    await this.prisma.invoice.create({
      data: {
        businessId,
        clientId,
        invoiceNumber: `GI-${doc.number || nextNum}`,
        type: localType as any,
        status: localStatus as any,
        issueDate,
        subtotal,
        vatRate,
        vatAmount,
        total: totalAmount,
        currency: doc.currency || 'ILS',
        notes: doc.description || doc.remarks || null,
        paidDate,
        paidAmount: localStatus === 'PAID' ? totalAmount : null,
        language: doc.lang || 'he',
        externalId: doc.id,
        externalSource: 'greeninvoice',
        externalUrl: doc.url?.origin || doc.url?.he || null,
        items: {
          create: (doc.income || []).map((item, i) => ({
            description: item.description || 'שירות',
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            amount: (item.quantity || 1) * (item.price || 0),
            sortOrder: i,
          })),
        },
      },
    });

    return true;
  }

  /** Create a document in Green Invoice from a local invoice */
  async pushInvoice(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { items: true, client: true },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    if (invoice.externalId) {
      throw new BadRequestException('Invoice already synced to Green Invoice');
    }

    const giType = LOCAL_TO_GI_TYPE[invoice.type] || 305;

    // Build document payload
    const payload: Record<string, unknown> = {
      type: giType,
      lang: invoice.language || 'he',
      currency: invoice.currency || 'ILS',
      signed: true,
      rounding: false,
      description: invoice.notes || '',
      income: invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        price: Number(item.unitPrice),
        currency: invoice.currency || 'ILS',
        vatType: 0, // default VAT
      })),
    };

    // Add client info
    if (invoice.client) {
      payload.client = {
        name: invoice.client.name,
        emails: invoice.client.email ? [invoice.client.email] : [],
        taxId: invoice.client.taxId || undefined,
        address: invoice.client.address || '',
        phone: invoice.client.phone || '',
        add: true, // Save to GI contacts
      };
    }

    // Create on Green Invoice
    const created = await this.apiRequest<GreenInvoiceDocument>(
      businessId,
      'POST',
      '/documents',
      payload,
    );

    // Update local invoice with external ID
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        externalId: created.id,
        externalSource: 'greeninvoice',
        externalUrl: created.url?.origin || created.url?.he || null,
        status: 'SENT',
      },
    });

    return {
      externalId: created.id,
      externalUrl: created.url?.origin || created.url?.he || null,
      documentNumber: created.number,
    };
  }

  /** Fetch documents from Green Invoice (for preview, without importing) */
  async listDocuments(
    businessId: string,
    options?: { page?: number; fromDate?: string; toDate?: string; type?: number[] },
  ) {
    const result = await this.apiRequest<GreenInvoiceSearchResult>(
      businessId,
      'POST',
      '/documents/search',
      {
        page: options?.page || 0,
        pageSize: 25,
        sort: 'documentDate',
        direction: 'desc',
        ...(options?.fromDate && { fromDate: options.fromDate }),
        ...(options?.toDate && { toDate: options.toDate }),
        ...(options?.type && { type: options.type }),
      },
    );

    return {
      items: result.items.map((doc) => ({
        id: doc.id,
        number: doc.number,
        type: doc.type,
        typeName: GI_DOC_TYPE_MAP[doc.type] || 'OTHER',
        status: doc.status,
        amount: doc.amount,
        currency: doc.currency,
        clientName: doc.client?.name || '',
        createdAt: doc.createdAt,
        url: doc.url?.origin || doc.url?.he || '',
      })),
      total: result.total,
      page: result.page,
    };
  }
}
