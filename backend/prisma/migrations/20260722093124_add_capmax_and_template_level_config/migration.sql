-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('ITEM', 'LEVEL');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "capMaxMarkup" DECIMAL(12,4),
ADD COLUMN     "capMaxRebate" DECIMAL(12,4),
ADD COLUMN     "capMaxTotal" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "type" "TemplateType" NOT NULL DEFAULT 'ITEM';

-- CreateTable
CREATE TABLE "TemplateLevelConfig" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "rebateUnit" DECIMAL(12,4) NOT NULL,
    "markupPips" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "TemplateLevelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateLevelConfig_templateId_level_idx" ON "TemplateLevelConfig"("templateId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateLevelConfig_templateId_level_assetId_key" ON "TemplateLevelConfig"("templateId", "level", "assetId");

-- CreateIndex
CREATE INDEX "Asset_capMaxRebate_idx" ON "Asset"("capMaxRebate");

-- CreateIndex
CREATE INDEX "Asset_capMaxTotal_idx" ON "Asset"("capMaxTotal");

-- CreateIndex
CREATE INDEX "Asset_capMaxMarkup_idx" ON "Asset"("capMaxMarkup");

-- AddForeignKey
ALTER TABLE "TemplateLevelConfig" ADD CONSTRAINT "TemplateLevelConfig_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateLevelConfig" ADD CONSTRAINT "TemplateLevelConfig_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
