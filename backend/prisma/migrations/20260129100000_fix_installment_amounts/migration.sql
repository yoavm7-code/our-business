-- Fix transactions where amount was wrongly stored as full total instead of per-installment.
-- 1) Backfill total_amount where null (assume stored amount is the full total; use ABS for expenses).
UPDATE "Transaction"
SET "total_amount" = ABS(amount)
WHERE installment_total IS NOT NULL AND installment_total > 0 AND "total_amount" IS NULL;

-- 2) Set amount = per-installment (total_amount / installment_total), preserve sign.
UPDATE "Transaction"
SET amount = CASE
  WHEN amount < 0 THEN -ROUND(("total_amount" / installment_total)::numeric, 2)
  ELSE ROUND(("total_amount" / installment_total)::numeric, 2)
END
WHERE installment_total IS NOT NULL AND installment_total > 0
  AND "total_amount" IS NOT NULL
  AND ABS(amount) >= ("total_amount" * 0.99);
