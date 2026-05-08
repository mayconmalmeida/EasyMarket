DO $$ BEGIN
  CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#0057D9',
    "icon" TEXT NOT NULL DEFAULT 'pi pi-tag',
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_status_name_idx" ON "Category"("status", "name");

CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "marketName" TEXT NOT NULL DEFAULT 'EasyMarket',
    "logoUrl" TEXT,
    "pixKey" TEXT NOT NULL DEFAULT '',
    "pixQrCodeUrl" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#0057D9',
    "minStockDefault" INTEGER NOT NULL DEFAULT 5,
    "collaboratorPortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
