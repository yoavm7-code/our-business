-- Add business_field column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "business_field" TEXT;
