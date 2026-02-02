-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN NOT NULL DEFAULT false;
