-- AlterTable: make account_id optional on transactions
ALTER TABLE "transactions" ALTER COLUMN "account_id" DROP NOT NULL;
