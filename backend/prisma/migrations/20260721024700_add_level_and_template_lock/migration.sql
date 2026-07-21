-- 1. Add level column to User (denormalized depth, set once at creation)
ALTER TABLE "User" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "User_level_idx" ON "User"("level");

-- 2. Add level column to Template (temporarily nullable for backfill)
ALTER TABLE "Template" ADD COLUMN "level" INTEGER;
CREATE INDEX "Template_level_idx" ON "Template"("level");

-- 3. Create TemplateLock table
CREATE TABLE "TemplateLock" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lockedByType" TEXT NOT NULL,
  "lockedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemplateLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TemplateLock_templateId_userId_key" ON "TemplateLock"("templateId", "userId");
CREATE INDEX "TemplateLock_userId_idx" ON "TemplateLock"("userId");
ALTER TABLE "TemplateLock" ADD CONSTRAINT "TemplateLock_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateLock" ADD CONSTRAINT "TemplateLock_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Backfill User.level from hierarchy (recursive CTE with depth guard)
WITH RECURSIVE levels AS (
  SELECT id, 0 AS lvl FROM "User" WHERE "parentId" IS NULL
  UNION ALL
  SELECT u.id, l.lvl + 1
  FROM "User" u JOIN levels l ON u."parentId" = l.id
  WHERE l.lvl < 50
)
UPDATE "User" u SET "level" = l.lvl FROM levels l WHERE u.id = l.id;

-- 5. Backfill Template.level: old templates get level=0, then set NOT NULL
-- NOTE: After migration, Admin MUST manually review every template and assign the correct level.
UPDATE "Template" SET "level" = 0 WHERE "level" IS NULL;
ALTER TABLE "Template" ALTER COLUMN "level" SET NOT NULL;
