-- Add business-specific columns to Household table
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "business_number" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "vat_id" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "logo_data" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "logo_mime" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "default_currency" TEXT NOT NULL DEFAULT 'ILS';
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 17;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceType" AS ENUM ('TAX_INVOICE', 'TAX_INVOICE_RECEIPT', 'RECEIPT', 'PRICE_QUOTE', 'DELIVERY_NOTE', 'CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaxType" AS ENUM ('VAT', 'INCOME_TAX', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaxPeriodStatus" AS ENUM ('OPEN', 'CALCULATED', 'FILED', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add INVOICE to TransactionSource enum if not exists
DO $$ BEGIN
  ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'INVOICE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: Client
CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tax_id" TEXT,
    "notes" TEXT,
    "hourly_rate" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Project
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "budget_amount" DECIMAL(14,2),
    "hourly_rate" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "start_date" DATE,
    "end_date" DATE,
    "color" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "client_id" TEXT,
    "project_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "notes" TEXT,
    "payment_terms" TEXT,
    "paid_date" DATE,
    "paid_amount" DECIMAL(14,2),
    "language" TEXT NOT NULL DEFAULT 'he',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceItem
CREATE TABLE IF NOT EXISTS "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TaxPeriod
CREATE TABLE IF NOT EXISTS "TaxPeriod" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "type" "TaxType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vat_collected" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vat_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vat_due" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_advance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "TaxPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "filed_date" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxPeriod_pkey" PRIMARY KEY ("id")
);

-- Add client_id and project_id to Transaction if not exists
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(14,2);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "is_vat_included" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "is_tax_deductible" BOOLEAN NOT NULL DEFAULT true;

-- Add is_tax_deductible and deduction_rate to Category if not exists
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "is_tax_deductible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "deduction_rate" DECIMAL(5,2);

-- CreateIndexes for Client
CREATE INDEX IF NOT EXISTS "Client_household_id_idx" ON "Client"("household_id");

-- CreateIndexes for Project
CREATE INDEX IF NOT EXISTS "Project_household_id_idx" ON "Project"("household_id");
CREATE INDEX IF NOT EXISTS "Project_client_id_idx" ON "Project"("client_id");

-- CreateIndexes for Invoice
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_household_id_invoice_number_key" ON "Invoice"("household_id", "invoice_number");
CREATE INDEX IF NOT EXISTS "Invoice_household_id_idx" ON "Invoice"("household_id");
CREATE INDEX IF NOT EXISTS "Invoice_client_id_idx" ON "Invoice"("client_id");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndexes for InvoiceItem
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoice_id_idx" ON "InvoiceItem"("invoice_id");

-- CreateIndexes for TaxPeriod
CREATE INDEX IF NOT EXISTS "TaxPeriod_household_id_idx" ON "TaxPeriod"("household_id");
CREATE INDEX IF NOT EXISTS "TaxPeriod_period_start_period_end_idx" ON "TaxPeriod"("period_start", "period_end");

-- CreateIndexes for Transaction (new columns)
CREATE INDEX IF NOT EXISTS "Transaction_client_id_idx" ON "Transaction"("client_id");
CREATE INDEX IF NOT EXISTS "Transaction_project_id_idx" ON "Transaction"("project_id");

-- AddForeignKeys for Client
ALTER TABLE "Client" ADD CONSTRAINT "Client_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys for Project
ALTER TABLE "Project" ADD CONSTRAINT "Project_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeys for Invoice
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeys for InvoiceItem
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys for TaxPeriod
ALTER TABLE "TaxPeriod" ADD CONSTRAINT "TaxPeriod_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys for Transaction (new relations)
DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
