ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYROLL_DEDUCTION';

ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "monthlyClosingId" TEXT;

CREATE TABLE IF NOT EXISTS "MonthlyClosing" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT NOT NULL,
    CONSTRAINT "MonthlyClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyClosing_year_month_key" ON "MonthlyClosing"("year", "month");
CREATE INDEX IF NOT EXISTS "MonthlyClosing_closedById_closedAt_idx" ON "MonthlyClosing"("closedById", "closedAt");

CREATE INDEX IF NOT EXISTS "Withdrawal_monthlyClosingId_idx" ON "Withdrawal"("monthlyClosingId");
CREATE INDEX IF NOT EXISTS "Withdrawal_userId_createdAt_idx" ON "Withdrawal"("userId", "createdAt");

ALTER TABLE "MonthlyClosing" ADD CONSTRAINT "MonthlyClosing_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_monthlyClosingId_fkey"
  FOREIGN KEY ("monthlyClosingId") REFERENCES "MonthlyClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
