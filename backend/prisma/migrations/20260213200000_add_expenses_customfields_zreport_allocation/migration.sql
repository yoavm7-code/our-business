-- CreateTable: CustomFieldTemplate
CREATE TABLE "CustomFieldTemplate" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Expense
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "category_id" TEXT,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "vendor" TEXT,
    "receipt_url" TEXT,
    "vat_amount" DECIMAL(14,2),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_tax_deductible" BOOLEAN NOT NULL DEFAULT true,
    "deduction_rate" DECIMAL(5,2),
    "notes" TEXT,
    "custom_fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ZReport
CREATE TABLE "ZReport" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "report_date" DATE NOT NULL,
    "report_number" INTEGER NOT NULL,
    "total_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_checks" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_transfers" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_refunds" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_vat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "invoice_count" INTEGER NOT NULL DEFAULT 0,
    "first_invoice_num" TEXT,
    "last_invoice_num" TEXT,
    "notes" TEXT,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZReport_pkey" PRIMARY KEY ("id")
);

-- Add allocation number fields to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "allocation_number" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "allocation_confirmation" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "allocation_date" TIMESTAMP(3);

-- Add custom fields to Client, Project, Invoice
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB;

-- Add Morning login credentials to Business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "green_invoice_email" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "green_invoice_password" TEXT;

-- CreateIndex
CREATE INDEX "CustomFieldTemplate_household_id_idx" ON "CustomFieldTemplate"("household_id");
CREATE INDEX "CustomFieldTemplate_entity_type_idx" ON "CustomFieldTemplate"("entity_type");

CREATE INDEX "Expense_household_id_date_idx" ON "Expense"("household_id", "date");
CREATE INDEX "Expense_category_id_idx" ON "Expense"("category_id");

CREATE UNIQUE INDEX "ZReport_household_id_report_date_key" ON "ZReport"("household_id", "report_date");
CREATE INDEX "ZReport_household_id_idx" ON "ZReport"("household_id");

-- AddForeignKey
ALTER TABLE "CustomFieldTemplate" ADD CONSTRAINT "CustomFieldTemplate_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ZReport" ADD CONSTRAINT "ZReport_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
