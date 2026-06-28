-- Add name column to User table
-- Run: npx prisma migrate deploy  (or prisma db push)
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
