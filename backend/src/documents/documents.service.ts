import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionSource } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { TransactionsService } from '../transactions/transactions.service';
import { RulesService } from '../rules/rules.service';
import { OcrService } from './ocr.service';
import { AiExtractService } from './ai-extract.service';
import { DocumentParserService, STRUCTURED_MIMES } from './document-parser.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private rulesService: RulesService,
    private ocrService: OcrService,
    private aiExtractService: AiExtractService,
    private documentParser: DocumentParserService,
  ) {}

  async createFromFile(
    householdId: string,
    accountId: string,
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new Error(
        'Invalid file type. Allowed: JPEG, PNG, WebP, PDF, CSV, Excel (.xlsx, .xls), Word (.docx, .doc)',
      );
    }
    const storagePath = path.join(UPLOAD_DIR, householdId, `${Date.now()}-${file.originalname}`);
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storagePath, file.buffer);

    const doc = await this.prisma.document.create({
      data: {
        householdId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        storagePath,
        fileSize: file.size,
        status: 'PENDING',
      },
    });

    this.processDocument(householdId, accountId, doc.id).catch((err) => {
      console.error('Document processing error:', err);
    });

    return doc;
  }

  async processDocument(householdId: string, accountId: string, documentId: string) {
    await this.prisma.document.updateMany({
      where: { id: documentId, householdId },
      data: { status: 'PROCESSING' },
    });

    try {
      const doc = await this.prisma.document.findFirst({
        where: { id: documentId, householdId },
      });
      if (!doc || !fs.existsSync(doc.storagePath)) {
        throw new Error('Document or file not found');
      }

      let ocrText = '';
      if (doc.mimeType.startsWith('image/')) {
        ocrText = await this.ocrService.getTextFromImage(doc.storagePath);
      } else if (STRUCTURED_MIMES.includes(doc.mimeType)) {
        ocrText = await this.documentParser.getTextFromFile(doc.storagePath, doc.mimeType);
      } else if (doc.mimeType === 'application/pdf') {
        await this.prisma.document.updateMany({
          where: { id: documentId, householdId },
          data: { status: 'FAILED', errorMessage: 'PDF extraction is not supported yet. Please upload an image (PNG/JPEG/WebP), CSV, Excel, or Word.' },
        });
        return;
      }

      await this.prisma.document.updateMany({
        where: { id: documentId, householdId },
        data: { ocrText: ocrText.slice(0, 50000) },
      });

      if (!ocrText || ocrText.trim().length < 10) {
        console.warn('[Documents] Document ' + documentId + ': OCR returned little or no text (length=' + (ocrText?.length ?? 0) + '). PDFs are not yet supported.');
      }

      const userContext = await this.buildUserContext(householdId);
      const extracted = await this.aiExtractService.extractTransactions(ocrText, userContext);
      if (extracted.length === 0) {
        console.warn('[Documents] Document ' + documentId + ': No transactions extracted (OCR length=' + (ocrText?.length ?? 0) + '). Check image quality or try a different format.');
      }

      // Check for duplicates: same account, date, amount, description
      type EnrichedItem = (typeof extracted)[0] & {
        isDuplicate?: boolean;
        existingTransaction?: { id: string; date: string; amount: number; description: string };
      };
      const enriched: EnrichedItem[] = [];
      let hasAnyDuplicate = false;
      for (const e of extracted) {
        const dateStr = String(e.date || '').trim().slice(0, 10);
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          enriched.push({ ...e });
          continue;
        }
        const existing = await this.prisma.transaction.findFirst({
          where: {
            householdId,
            accountId,
            date: new Date(dateStr + 'T00:00:00.000Z'),
            amount: e.amount,
            description: e.description,
          },
          select: { id: true, date: true, amount: true, description: true },
        });
        if (existing) {
          hasAnyDuplicate = true;
          enriched.push({
            ...e,
            isDuplicate: true,
            existingTransaction: {
              id: existing.id,
              date: existing.date instanceof Date ? existing.date.toISOString().slice(0, 10) : String(existing.date),
              amount: Number(existing.amount),
              description: String(existing.description || ''),
            },
          });
        } else {
          enriched.push({ ...e });
        }
      }

      if (hasAnyDuplicate) {
        await this.prisma.document.updateMany({
          where: { id: documentId, householdId },
          data: {
            status: 'PENDING_REVIEW',
            extractedJson: enriched as unknown as object,
            processedAt: new Date(),
          },
        });
        return;
      }

      // No duplicates – create all
      await this.transactionsService.createMany(
        householdId,
        accountId,
        extracted.map((e) => ({
          date: e.date,
          description: e.description,
          amount: e.amount,
          categorySlug: e.categorySlug,
          totalAmount: e.totalAmount,
          installmentCurrent: e.installmentCurrent,
          installmentTotal: e.installmentTotal,
        })),
        TransactionSource.UPLOAD,
        documentId,
      );

      await this.prisma.document.updateMany({
        where: { id: documentId, householdId },
        data: {
          status: 'COMPLETED',
          extractedJson: extracted as unknown as object,
          processedAt: new Date(),
          ...(extracted.length === 0 && {
            errorMessage: 'No transactions extracted. Try better image quality or expand date range on Transactions page.',
          }),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.document.updateMany({
        where: { id: documentId, householdId },
        data: { status: 'FAILED', errorMessage: message },
      });
    }
  }

  /** Build context from user's rules and recent transactions so the AI can learn their preferences. */
  private async buildUserContext(householdId: string): Promise<string> {
    const parts: string[] = [];
    try {
      const rules = await this.rulesService.findAll(householdId);
      if (rules.length > 0) {
        const ruleLines = rules
          .slice(0, 30)
          .map((r) => 'when description contains "' + ((r.pattern || '').slice(0, 40)) + '" use category ' + ((r.category as { slug?: string })?.slug ?? 'other'));
        parts.push('Rules (learned from user corrections): ' + ruleLines.join('; '));
      }
      const recent = await this.prisma.transaction.findMany({
        where: { householdId },
        orderBy: { date: 'desc' },
        take: 50,
        select: { description: true, category: { select: { slug: true } } },
      });
      const seen = new Set<string>();
      const recentLines: string[] = [];
      for (const t of recent) {
        const desc = (t.description || '').trim().slice(0, 50);
        const slug = (t.category as { slug?: string } | null)?.slug ?? 'other';
        if (desc && !seen.has(desc)) {
          seen.add(desc);
          recentLines.push('"' + desc + '" -> ' + slug);
        }
      }
      if (recentLines.length > 0) {
        parts.push('Recent categorizations (prefer when description matches): ' + recentLines.slice(0, 25).join('; '));
      }
    } catch {
      // ignore - context is optional
    }
    return parts.join('\n');
  }

  async findAll(householdId: string) {
    return this.prisma.document.findMany({
      where: { householdId },
      orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async findOne(householdId: string, id: string) {
    return this.prisma.document.findFirst({
      where: { id, householdId },
      include: { transactions: true, _count: { select: { transactions: true } } },
    });
  }

  /** Confirm import after PENDING_REVIEW: create selected transactions and set COMPLETED. */
  async confirmImport(
    householdId: string,
    documentId: string,
    body: { accountId: string; action: 'add_all' | 'skip_duplicates' | 'add_none'; selectedIndices?: number[] },
  ) {
    const accountId = body.accountId;
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, householdId },
    });
    if (!doc || doc.status !== 'PENDING_REVIEW') {
      throw new Error('Document not found or not pending review');
    }
    const raw = doc.extractedJson as Array<{
      date: string;
      description: string;
      amount: number;
      categorySlug?: string;
      totalAmount?: number;
      installmentCurrent?: number;
      installmentTotal?: number;
      isDuplicate?: boolean;
    }> | null;
    if (!Array.isArray(raw) || raw.length === 0 || body.action === 'add_none') {
      await this.prisma.document.updateMany({
        where: { id: documentId, householdId },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });
      return this.findOne(householdId, documentId);
    }
    let toCreate = raw;
    if (body.action === 'skip_duplicates') {
      toCreate = raw.filter((t) => !t.isDuplicate);
    } else if (Array.isArray(body.selectedIndices) && body.selectedIndices.length > 0) {
      toCreate = body.selectedIndices
        .filter((i) => i >= 0 && i < raw.length)
        .map((i) => raw[i]);
    }
    const items = toCreate.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      categorySlug: t.categorySlug,
      totalAmount: t.totalAmount,
      installmentCurrent: t.installmentCurrent,
      installmentTotal: t.installmentTotal,
    }));
    if (items.length > 0) {
      await this.transactionsService.createMany(
        householdId,
        accountId,
        items,
        TransactionSource.UPLOAD,
        documentId,
      );
    }
    await this.prisma.document.updateMany({
      where: { id: documentId, householdId },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });
    return this.findOne(householdId, documentId);
  }
}
