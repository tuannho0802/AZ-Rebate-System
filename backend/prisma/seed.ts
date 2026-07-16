import { PrismaClient, Role, AssetCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================================
// Reusable: đảm bảo MỌI Template có đủ TemplateItem cho MỌI Asset hiện có
// trong DB, mặc định rebateUnit=0, markupPips=0 nếu chưa tồn tại.
// Gọi lại hàm này bất cứ lúc nào (kể cả sau khi thêm Asset mới bằng tay)
// để đồng bộ lại toàn bộ Template mà không mất dữ liệu đã set.
//
// LƯU Ý: đây chỉ là biện pháp đồng bộ THỦ CÔNG (chạy seed lại hoặc gọi
// script này). Để tự động hoá vĩnh viễn (mỗi khi Admin tạo Asset mới qua
// API thì mọi Template tự có thêm item = 0 ngay lập tức, không cần chạy
// lại seed), cần gắn logic tương đương vào AssetService.create() ở
// tầng application — xem phần trao đổi cuối cùng trong chat.
// ============================================================================
export async function syncAllTemplatesWithAssets(): Promise<void> {
  const [templates, assets] = await Promise.all([
    prisma.template.findMany({ select: { id: true, name: true } }),
    prisma.asset.findMany({ select: { id: true, code: true } }),
  ]);

  let createdCount = 0;
  for (const template of templates) {
    for (const asset of assets) {
      const result = await prisma.templateItem.upsert({
        where: { templateId_assetId: { templateId: template.id, assetId: asset.id } },
        update: {}, // đã tồn tại -> KHÔNG đụng vào giá trị đã set
        create: {
          templateId: template.id,
          assetId: asset.id,
          rebateUnit: 0,
          markupPips: 0,
        },
      });
      // Prisma upsert không tự báo có phải vừa tạo mới hay không, nên dò qua createdAt/updatedAt
      // không đáng tin cậy ở đây -> đơn giản đếm tổng số item đã đảm bảo tồn tại thay vì đếm "mới tạo"
      void result;
      createdCount++;
    }
  }
  console.log(
    `  -> syncAllTemplatesWithAssets: đảm bảo đủ ${createdCount} cặp (template x asset) cho ${templates.length} template(s) x ${assets.length} asset(s)`,
  );
}

async function main() {
  // ==========================================================================
  // 1. Seed Assets (đọc lại toàn bộ asset hiện có sau khi upsert, KHÔNG hardcode
  //    số lượng — nếu DB đã có thêm asset khác từ trước, vẫn được giữ nguyên
  //    và đưa vào bước đồng bộ Template ở cuối).
  // ==========================================================================
  const assetSeedList = [
    { code: 'D_FOREX', name: 'Forex trực tiếp', category: AssetCategory.FOREX },
    { code: 'FOREX', name: 'Forex', category: AssetCategory.FOREX },
    { code: 'GOLD', name: 'Vàng', category: AssetCategory.METAL },
    { code: 'SILVER_5000', name: 'Bạc (lô 5000)', category: AssetCategory.METAL },
    { code: 'SILVER_1000', name: 'Bạc (lô 1000)', category: AssetCategory.METAL },
    { code: 'OIL', name: 'Dầu', category: AssetCategory.ENERGY },
    { code: 'NATURE_GAS', name: 'Khí tự nhiên', category: AssetCategory.ENERGY },
    { code: 'COMMODITIES', name: 'Hàng hóa', category: AssetCategory.COMMODITY },
    { code: 'HKG50', name: 'Chỉ số Hồng Kông 50', category: AssetCategory.INDEX },
    { code: 'A50', name: 'Chỉ số A50 (China A50)', category: AssetCategory.INDEX },
    { code: 'JPN225', name: 'Chỉ số Nhật Bản 225', category: AssetCategory.INDEX },
    { code: 'US_INDEX', name: 'Chỉ số Mỹ', category: AssetCategory.INDEX },
    { code: 'SHARES', name: 'Cổ phiếu', category: AssetCategory.SHARES },
    { code: 'ETHEREUM', name: 'Ethereum', category: AssetCategory.CRYPTO },
    { code: 'PRECIOUS_METAL', name: 'Kim loại quý', category: AssetCategory.METAL },
    { code: 'BITCOIN', name: 'Bitcoin', category: AssetCategory.CRYPTO },
    { code: 'CRYPTO', name: 'Tiền điện tử (chung)', category: AssetCategory.CRYPTO },
    { code: 'GAUCNH', name: 'GAUCNH', category: AssetCategory.OTHER },
  ];

  for (const asset of assetSeedList) {
    await prisma.asset.upsert({
      where: { code: asset.code },
      update: {},
      create: asset,
    });
  }
  console.log(`[1] Assets: ${assetSeedList.length} asset(s) đảm bảo tồn tại`);

  // ==========================================================================
  // 2. Seed Admin + Users (2 cây MIB độc lập, giữ nguyên cấu trúc đã dùng
  //    xuyên suốt các phiên test trước — KHÔNG đổi ID nếu DB đã seed rồi,
  //    vì upsert theo email sẽ giữ nguyên record cũ).
  // ==========================================================================
  const passwordHash = await bcrypt.hash('Test@1234', 10);

  const admin = await prisma.adminAccount.upsert({
    where: { email: 'admin_test@azrebate.com' },
    update: {},
    create: {
      email: 'admin_test@azrebate.com',
      passwordHash,
      fullName: 'Admin Test',
    },
  });

  // Admin phụ, dùng để test rule "chỉ Root Admin mới xoá được Admin khác" (nếu có ProtectRootAdminGuard)
  const admin2 = await prisma.adminAccount.upsert({
    where: { email: 'admin2_test@azrebate.com' },
    update: {},
    create: {
      email: 'admin2_test@azrebate.com',
      passwordHash,
      fullName: 'Admin Test 2 (non-root)',
    },
  });

  // ---- Cây MIB 1 (nhánh chính, dùng cho hầu hết test case) ----
  const mib1 = await prisma.user.upsert({
    where: { email: 'mib@test.com' },
    update: {},
    create: {
      email: 'mib@test.com',
      passwordHash,
      fullName: 'Tran Cong Toai',
      role: Role.MIB,
      createdByAdminId: admin.id,
    },
  });

  const lv1a = await prisma.user.upsert({
    where: { email: 'lv1-a@test.com' },
    update: {},
    create: {
      email: 'lv1-a@test.com',
      passwordHash,
      fullName: 'Dong Ho Nguyen',
      role: Role.IB,
      parentId: mib1.id,
    },
  });

  const lv1b = await prisma.user.upsert({
    where: { email: 'lv1-b@test.com' },
    update: {},
    create: {
      email: 'lv1-b@test.com',
      passwordHash,
      fullName: 'Level 1 B',
      role: Role.IB,
      parentId: mib1.id,
    },
  });

  const lv2a = await prisma.user.upsert({
    where: { email: 'lv2-a@test.com' },
    update: {},
    create: {
      email: 'lv2-a@test.com',
      passwordHash,
      fullName: 'Level 2 A',
      role: Role.IB,
      parentId: lv1a.id,
    },
  });

  const lv2b = await prisma.user.upsert({
    where: { email: 'lv2-b@test.com' },
    update: {},
    create: {
      email: 'lv2-b@test.com',
      passwordHash,
      fullName: 'Level 2 B',
      role: Role.IB,
      parentId: lv1a.id,
    },
  });

  const lv2c = await prisma.user.upsert({
    where: { email: 'lv2-c@test.com' },
    update: {},
    create: {
      email: 'lv2-c@test.com',
      passwordHash,
      fullName: 'Level 2 C',
      role: Role.IB,
      parentId: lv1b.id,
    },
  });

  const lv3a = await prisma.user.upsert({
    where: { email: 'lv3-a@test.com' },
    update: {},
    create: {
      email: 'lv3-a@test.com',
      passwordHash,
      fullName: 'Level 3 A',
      role: Role.IB,
      parentId: lv2a.id,
    },
  });

  const lv3b = await prisma.user.upsert({
    where: { email: 'lv3-b@test.com' },
    update: {},
    create: {
      email: 'lv3-b@test.com',
      passwordHash,
      fullName: 'Level 3 B',
      role: Role.IB,
      parentId: lv2a.id,
    },
  });

  // ---- Cây MIB 2 (nhánh tách biệt hoàn toàn, dùng test permission cross-branch) ----
  const mib2 = await prisma.user.upsert({
    where: { email: 'mib2@test.com' },
    update: {},
    create: {
      email: 'mib2@test.com',
      passwordHash,
      fullName: 'MIB 2',
      role: Role.MIB,
      createdByAdminId: admin.id,
    },
  });

  const lv1c = await prisma.user.upsert({
    where: { email: 'lv1-c@test.com' },
    update: {},
    create: {
      email: 'lv1-c@test.com',
      passwordHash,
      fullName: 'Level 1 C (nhánh mib2)',
      role: Role.IB,
      parentId: mib2.id,
    },
  });

  const lv2c2 = await prisma.user.upsert({
    where: { email: 'lv2-c2@test.com' },
    update: {},
    create: {
      email: 'lv2-c2@test.com',
      passwordHash,
      fullName: 'Level 2 C2 (nhánh mib2)',
      role: Role.IB,
      parentId: lv1c.id,
    },
  });

  console.log('[2] Admin + Users: 2 admin, 2 cây MIB (11 user) đảm bảo tồn tại');

  // ==========================================================================
  // 3. Seed Templates — đủ TemplateItem cho MỌI Asset hiện có trong DB.
  //    "Standard Template": vài asset chính có giá trị mẫu, còn lại = 0.
  //    "Premium Template": giá trị cao hơn cho asset chính, còn lại = 0.
  // ==========================================================================
  const standardTemplate = await prisma.template.upsert({
    where: { name: 'Standard Template' },
    update: {},
    create: {
      name: 'Standard Template',
      description: 'Template mặc định — rebate/markup cơ bản cho các asset chính, còn lại = 0',
      createdByAdminId: admin.id,
    },
  });

  const premiumTemplate = await prisma.template.upsert({
    where: { name: 'Premium Template' },
    update: {},
    create: {
      name: 'Premium Template',
      description: 'Template cao cấp — rebate/markup cao hơn cho asset chính, còn lại = 0',
      createdByAdminId: admin.id,
    },
  });

  // Giá trị mẫu CHỈ áp dụng cho vài asset chính, còn lại mặc định 0
  // (sẽ được điền tự động ở bước syncAllTemplatesWithAssets bên dưới)
  const standardSampleValues: Record<string, { rebateUnit: number; markupPips: number }> = {
    GOLD: { rebateUnit: 5, markupPips: 5 },
    FOREX: { rebateUnit: 3, markupPips: 3 },
    D_FOREX: { rebateUnit: 3, markupPips: 3 },
    BITCOIN: { rebateUnit: 2, markupPips: 2 },
    ETHEREUM: { rebateUnit: 2, markupPips: 2 },
  };

  const premiumSampleValues: Record<string, { rebateUnit: number; markupPips: number }> = {
    GOLD: { rebateUnit: 10, markupPips: 10 },
    FOREX: { rebateUnit: 6, markupPips: 6 },
    D_FOREX: { rebateUnit: 6, markupPips: 6 },
    BITCOIN: { rebateUnit: 4, markupPips: 4 },
    ETHEREUM: { rebateUnit: 4, markupPips: 4 },
  };

  const allAssets = await prisma.asset.findMany({ select: { id: true, code: true } });

  for (const asset of allAssets) {
    const std = standardSampleValues[asset.code] ?? { rebateUnit: 0, markupPips: 0 };
    await prisma.templateItem.upsert({
      where: { templateId_assetId: { templateId: standardTemplate.id, assetId: asset.id } },
      update: {},
      create: {
        templateId: standardTemplate.id,
        assetId: asset.id,
        rebateUnit: std.rebateUnit,
        markupPips: std.markupPips,
      },
    });

    const prem = premiumSampleValues[asset.code] ?? { rebateUnit: 0, markupPips: 0 };
    await prisma.templateItem.upsert({
      where: { templateId_assetId: { templateId: premiumTemplate.id, assetId: asset.id } },
      update: {},
      create: {
        templateId: premiumTemplate.id,
        assetId: asset.id,
        rebateUnit: prem.rebateUnit,
        markupPips: prem.markupPips,
      },
    });
  }
  console.log(`[3] Templates: 2 template(s) đủ item cho ${allAssets.length} asset(s)`);

  // ==========================================================================
  // 4. Đồng bộ lại lần cuối (idempotent) — phòng trường hợp DB có asset khác
  //    ngoài danh sách seed ở trên (ví dụ asset thêm tay trước khi chạy seed).
  // ==========================================================================
  await syncAllTemplatesWithAssets();

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });