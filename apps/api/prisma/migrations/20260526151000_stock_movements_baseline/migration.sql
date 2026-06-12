-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StockMovementSource" AS ENUM ('STOCK_ENTRY', 'WITHDRAWAL', 'MANUAL_ADJUSTMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable Product (barcode/costCents)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costCents" INTEGER;

-- CreateIndex (barcode unique)
CREATE UNIQUE INDEX IF NOT EXISTS "Product_barcode_key" ON "Product"("barcode");

-- CreateTable StockMovement
CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "source" "StockMovementSource" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCostCents" INTEGER,
  "unitPriceCents" INTEGER,
  "barcodeSnapshot" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "actorId" TEXT NOT NULL,
  "withdrawalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMovement_productId_occurredAt_idx" ON "StockMovement"("productId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StockMovement_actorId_occurredAt_idx" ON "StockMovement"("actorId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StockMovement_type_source_occurredAt_idx" ON "StockMovement"("type", "source", "occurredAt");
CREATE INDEX IF NOT EXISTS "StockMovement_withdrawalId_idx" ON "StockMovement"("withdrawalId");

-- AddForeignKey (StockMovement.productId -> Product.id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_productId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (StockMovement.actorId -> User.id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_actorId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (StockMovement.withdrawalId -> Withdrawal.id) ON DELETE SET NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_withdrawalId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_withdrawalId_fkey"
      FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

