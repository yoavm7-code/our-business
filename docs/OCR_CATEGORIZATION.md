# OCR + AI Categorization Pipeline

## Overview

1. **Upload**: User uploads an image (or PDF) of a statement/receipt.
2. **Storage**: File is saved to disk (or S3) and a `Document` record is created with status `PENDING`.
3. **OCR**: Background job runs; for images we use Tesseract (or Google Vision / AWS Textract).
4. **AI extraction**: OCR text is sent to OpenAI to extract structured transactions (date, description, amount, optional category).
5. **Transactions**: Extracted rows are inserted as `Transaction` with source `UPLOAD` and linked to the document.
6. **Categorization**: Each transaction gets a category via rules first; if no rule matches, AI can suggest (or leave uncategorized). User can reassign category; that creates a **rule** so future similar descriptions are auto-categorized.

## Code locations

- **Backend**
  - `backend/src/documents/documents.service.ts` – `createFromFile`, `processDocument`
  - `backend/src/documents/ocr.service.ts` – `getTextFromImage` (Tesseract)
  - `backend/src/documents/ai-extract.service.ts` – `extractTransactions` (OpenAI), `fallbackExtract` (regex)
  - `backend/src/rules/rules.service.ts` – `suggestCategory`, `learnFromCorrection`
  - `backend/src/transactions/transactions.service.ts` – `createMany` (uses rules for category)

## Example: OCR service (Tesseract)

```typescript
// backend/src/documents/ocr.service.ts
async getTextFromImage(imagePath: string): Promise<string> {
  const provider = process.env.OCR_PROVIDER || 'tesseract';
  if (provider === 'tesseract') return this.tesseractExtract(imagePath);
  return this.tesseractExtract(imagePath);
}
private async tesseractExtract(imagePath: string): Promise<string> {
  if (!this.worker) {
    this.worker = await createWorker('eng', 1, { logger: () => {} });
  }
  const { data: { text } } = await this.worker.recognize(imagePath);
  return text || '';
}
```

## Example: AI extraction (OpenAI)

```typescript
// backend/src/documents/ai-extract.service.ts
async extractTransactions(ocrText: string): Promise<ExtractedTransaction[]> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a financial data extractor...' },
      { role: 'user', content: `Extract transactions from this text:\n\n${ocrText}` },
    ],
    response_format: { type: 'json_object' },
  });
  const parsed = JSON.parse(completion.choices[0].message.content);
  return parsed.transactions; // [{ date, description, amount, categorySlug? }]
}
```

## Example: Rule-based + learning categorization

```typescript
// backend/src/rules/rules.service.ts
async suggestCategory(householdId: string, description: string): Promise<string | null> {
  const rules = await this.prisma.categoryRule.findMany({
    where: { householdId, isActive: true },
    orderBy: { priority: 'desc' },
    include: { category: true },
  });
  const normalized = description.toUpperCase();
  for (const rule of rules) {
    if (rule.patternType === 'contains' && normalized.includes(rule.pattern.toUpperCase()))
      return rule.categoryId;
    // ... startsWith, regex
  }
  return null;
}
async learnFromCorrection(householdId: string, description: string, categoryId: string): Promise<void> {
  await this.prisma.categoryRule.create({
    data: { householdId, categoryId, pattern: description.slice(0, 80), patternType: 'contains', priority: 10 },
  });
}
```

## Flow diagram

```
[User] → Upload file + accountId
    → DocumentsService.createFromFile() → save file, create Document (PENDING)
    → processDocument() (async)
        → OcrService.getTextFromImage() → ocrText
        → AiExtractService.extractTransactions(ocrText) → [{ date, description, amount, categorySlug? }]
        → TransactionsService.createMany() → for each: RulesService.suggestCategory() → categoryId
        → Document status = COMPLETED, extractedJson saved
[User] → Reassign category on transaction
    → PATCH /api/transactions/:id/category { categoryId }
    → RulesService.learnFromCorrection(description, categoryId) → new rule
```

## Adding Google Vision or AWS Textract

In `ocr.service.ts`, add:

- `if (provider === 'google') return this.googleVisionExtract(imagePath);`
- Implement `googleVisionExtract` using `@google-cloud/vision` and `imageAnnotatorClient.textDetection()`.
- Similarly for AWS: `if (provider === 'aws') return this.awsTextractExtract(imagePath);` and use `TextractClient.DetectDocumentText()`.

Keep Tesseract as fallback when cloud credentials are not set.
