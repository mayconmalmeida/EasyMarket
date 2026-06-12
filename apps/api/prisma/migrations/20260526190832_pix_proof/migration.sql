-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "pixProofFileName" TEXT,
ADD COLUMN     "pixProofMimeType" TEXT,
ADD COLUMN     "pixProofPath" TEXT,
ADD COLUMN     "pixProofUploadedAt" TIMESTAMP(3);
