-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MIB', 'IB');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('FOREX', 'METAL', 'ENERGY', 'COMMODITY', 'INDEX', 'SHARES', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutSessionStatus" AS ENUM ('DRAFT', 'LOCKED', 'COMPLETED');

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "rebateUnit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "markupPips" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCommissionConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "rebateUnit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "markupPips" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "transferUnit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "baseVolume" DECIMAL(18,4) NOT NULL,
    "status" "PayoutSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceUserId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "payoutSessionId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "netRebate" DECIMAL(12,4) NOT NULL,
    "netMarkup" DECIMAL(12,4) NOT NULL,
    "netTransferUnit" DECIMAL(12,4) NOT NULL,
    "calculatedValue" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorAdminId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_email_key" ON "AdminAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_parentId_idx" ON "User"("parentId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_key" ON "Template"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateItem_templateId_assetId_key" ON "TemplateItem"("templateId", "assetId");

-- CreateIndex
CREATE INDEX "UserCommissionConfig_userId_idx" ON "UserCommissionConfig"("userId");

-- CreateIndex
CREATE INDEX "UserCommissionConfig_assetId_idx" ON "UserCommissionConfig"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCommissionConfig_userId_assetId_key" ON "UserCommissionConfig"("userId", "assetId");

-- CreateIndex
CREATE INDEX "PayoutSession_sourceUserId_idx" ON "PayoutSession"("sourceUserId");

-- CreateIndex
CREATE INDEX "PayoutSession_status_idx" ON "PayoutSession"("status");

-- CreateIndex
CREATE INDEX "CommissionLedger_beneficiaryId_idx" ON "CommissionLedger"("beneficiaryId");

-- CreateIndex
CREATE INDEX "CommissionLedger_payoutSessionId_idx" ON "CommissionLedger"("payoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_payoutSessionId_beneficiaryId_key" ON "CommissionLedger"("payoutSessionId", "beneficiaryId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommissionConfig" ADD CONSTRAINT "UserCommissionConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommissionConfig" ADD CONSTRAINT "UserCommissionConfig_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutSession" ADD CONSTRAINT "PayoutSession_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutSession" ADD CONSTRAINT "PayoutSession_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutSession" ADD CONSTRAINT "PayoutSession_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_payoutSessionId_fkey" FOREIGN KEY ("payoutSessionId") REFERENCES "PayoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity transferUnit = rebate + markup, non-negative
ALTER TABLE "UserCommissionConfig"
  ADD CONSTRAINT "check_config_sum" CHECK ("transferUnit" = "rebateUnit" + "markupPips"),
  ADD CONSTRAINT "check_config_nonneg" CHECK ("rebateUnit" >= 0 AND "markupPips" >= 0);

ALTER TABLE "TemplateItem"
  ADD CONSTRAINT "check_template_nonneg" CHECK ("rebateUnit" >= 0 AND "markupPips" >= 0);

-- MIB (parentId null) and IB (parentId not null) roles
ALTER TABLE "User"
  ADD CONSTRAINT "check_role_parent" CHECK (
    ("role" = 'MIB' AND "parentId" IS NULL) OR
    ("role" = 'IB' AND "parentId" IS NOT NULL)
  );

-- Ledger non-negative
ALTER TABLE "CommissionLedger"
  ADD CONSTRAINT "check_ledger_nonneg" CHECK (
    "netTransferUnit" >= 0 AND "calculatedValue" >= 0
  );
