-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "total_amount" DECIMAL(14,2),
ADD COLUMN "installment_current" INTEGER,
ADD COLUMN "installment_total" INTEGER;
