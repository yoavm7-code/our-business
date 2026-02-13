-- Upload confirmation preferences on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "confirm_uploads" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "auto_create_categories" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "upload_confirm_skip_rules" JSONB;

-- Green Invoice integration on Business (Household)
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "green_invoice_key_id" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "green_invoice_secret" TEXT;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "green_invoice_sandbox" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "green_invoice_last_sync" TIMESTAMP(3);

-- External invoice tracking (for Green Invoice sync)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "external_id" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "external_source" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "external_url" TEXT;

-- Index for faster external ID lookups
CREATE INDEX IF NOT EXISTS "Invoice_external_id_idx" ON "Invoice"("external_id");
