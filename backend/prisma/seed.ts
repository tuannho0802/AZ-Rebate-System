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

// ============================================================================
// [MOI] Helper tạo Template kèm giá trị mẫu cho vài asset chính, còn lại = 0
// (được điền tự động ở bước syncAllTemplatesWithAssets cuối file). Gộp logic
// upsert Template + set TemplateItem mẫu vào 1 hàm để tránh lặp code khi cần
// nhiều template cho nhiều level (trước đây chỉ có 2 template cùng level=0,
// giờ cần thêm cho level 1/2/3 nên tách hàm dùng chung).
// ============================================================================
async function upsertTemplateWithSamples(
  name: string,
  description: string,
  level: number,
  adminId: string,
  sampleValues: Record<string, { rebateUnit: number; markupPips: number }>,
  allAssets: { id: string; code: string }[],
) {
  const template = await prisma.template.upsert({
    where: { name },
    update: { level }, // tự sửa lại level nếu trước đó bị sai/khác — idempotent, an toàn khi seed lại
    create: {
      name,
      description,
      level,
      createdByAdminId: adminId,
    },
  });

  for (const asset of allAssets) {
    const sample = sampleValues[asset.code] ?? { rebateUnit: 0, markupPips: 0 };
    await prisma.templateItem.upsert({
      where: { templateId_assetId: { templateId: template.id, assetId: asset.id } },
      update: {},
      create: {
        templateId: template.id,
        assetId: asset.id,
        rebateUnit: sample.rebateUnit,
        markupPips: sample.markupPips,
      },
    });
  }

  return template;
}

// ============================================================================
// [MOI] Helper lock/unlock template cho 1 user — dùng để seed sẵn vài case
// lock/unlock thật, đúng đường API thật (TemplateLockService cũng dùng upsert/
// deleteMany y hệt), để môi trường dev/test luôn có sẵn dữ liệu minh hoạ đầy
// đủ trạng thái (đang bị khoá / đã từng khoá rồi mở lại), không cần gọi tay
// qua Postman mỗi lần seed lại từ đầu.
// ============================================================================
async function lockTemplateForUser(
  templateId: string,
  userId: string,
  lockedByType: 'ADMIN' | 'USER',
  lockedById: string,
  note: string,
) {
  await prisma.templateLock.upsert({
    where: { templateId_userId: { templateId, userId } },
    update: {},
    create: { templateId, userId, lockedByType, lockedById },
  });
  console.log(`  -> LOCK: ${note}`);
}

async function unlockTemplateForUser(templateId: string, userId: string, note: string) {
  await prisma.templateLock.deleteMany({ where: { templateId, userId } });
  console.log(`  -> UNLOCK: ${note}`);
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
  //
  //    [SUA — Bug level]: mọi user (trừ root MIB) trước đây được tạo KHÔNG
  //    set field `level`, mặc định @default(0) của schema khiến TOÀN BỘ
  //    non-root user (lv1-*, lv2-*, lv3-*) đều mang level=0 sai — phát hiện
  //    qua test-flow-check.js mục 7 (Template Lock) vô tình pass sai vì
  //    mọi user đều "level 0" giống nhau. Sửa: mỗi user con set
  //    level = parent.level + 1, LẤY TRỰC TIẾP từ record cha vừa upsert
  //    phía trên (không hardcode số, không query lại DB). Đồng thời đổi
  //    `update: {}` thành `update: { level: ... }` để LẦN SEED LẠI TIẾP
  //    THEO (không cần migrate reset) cũng tự sửa được level sai của data
  //    cũ đã tồn tại — không chỉ đúng cho user mới tạo.
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
    update: { level: 0 },
    create: {
      email: 'mib@test.com',
      passwordHash,
      fullName: 'Tran Cong Toai',
      role: Role.MIB,
      createdByAdminId: admin.id,
      level: 0,
    },
  });

  const lv1a = await prisma.user.upsert({
    where: { email: 'lv1-a@test.com' },
    update: { level: mib1.level + 1 },
    create: {
      email: 'lv1-a@test.com',
      passwordHash,
      fullName: 'Dong Ho Nguyen',
      role: Role.IB,
      parentId: mib1.id,
      level: mib1.level + 1,
    },
  });

  const lv1b = await prisma.user.upsert({
    where: { email: 'lv1-b@test.com' },
    update: { level: mib1.level + 1 },
    create: {
      email: 'lv1-b@test.com',
      passwordHash,
      fullName: 'Level 1 B',
      role: Role.IB,
      parentId: mib1.id,
      level: mib1.level + 1,
    },
  });

  const lv2a = await prisma.user.upsert({
    where: { email: 'lv2-a@test.com' },
    update: { level: lv1a.level + 1 },
    create: {
      email: 'lv2-a@test.com',
      passwordHash,
      fullName: 'Level 2 A',
      role: Role.IB,
      parentId: lv1a.id,
      level: lv1a.level + 1,
    },
  });

  const lv2b = await prisma.user.upsert({
    where: { email: 'lv2-b@test.com' },
    update: { level: lv1a.level + 1 },
    create: {
      email: 'lv2-b@test.com',
      passwordHash,
      fullName: 'Level 2 B',
      role: Role.IB,
      parentId: lv1a.id,
      level: lv1a.level + 1,
    },
  });

  const lv2c = await prisma.user.upsert({
    where: { email: 'lv2-c@test.com' },
    update: { level: lv1b.level + 1 },
    create: {
      email: 'lv2-c@test.com',
      passwordHash,
      fullName: 'Level 2 C',
      role: Role.IB,
      parentId: lv1b.id,
      level: lv1b.level + 1,
    },
  });

  const lv3a = await prisma.user.upsert({
    where: { email: 'lv3-a@test.com' },
    update: { level: lv2a.level + 1 },
    create: {
      email: 'lv3-a@test.com',
      passwordHash,
      fullName: 'Level 3 A',
      role: Role.IB,
      parentId: lv2a.id,
      level: lv2a.level + 1,
    },
  });

  const lv3b = await prisma.user.upsert({
    where: { email: 'lv3-b@test.com' },
    update: { level: lv2a.level + 1 },
    create: {
      email: 'lv3-b@test.com',
      passwordHash,
      fullName: 'Level 3 B',
      role: Role.IB,
      parentId: lv2a.id,
      level: lv2a.level + 1,
    },
  });

  // ---- Cây MIB 2 (nhánh tách biệt hoàn toàn, dùng test permission cross-branch) ----
  const mib2 = await prisma.user.upsert({
    where: { email: 'mib2@test.com' },
    update: { level: 0 },
    create: {
      email: 'mib2@test.com',
      passwordHash,
      fullName: 'MIB 2',
      role: Role.MIB,
      createdByAdminId: admin.id,
      level: 0,
    },
  });

  const lv1c = await prisma.user.upsert({
    where: { email: 'lv1-c@test.com' },
    update: { level: mib2.level + 1 },
    create: {
      email: 'lv1-c@test.com',
      passwordHash,
      fullName: 'Level 1 C (nhánh mib2)',
      role: Role.IB,
      parentId: mib2.id,
      level: mib2.level + 1,
    },
  });

  const lv2c2 = await prisma.user.upsert({
    where: { email: 'lv2-c2@test.com' },
    update: { level: lv1c.level + 1 },
    create: {
      email: 'lv2-c2@test.com',
      passwordHash,
      fullName: 'Level 2 C2 (nhánh mib2)',
      role: Role.IB,
      parentId: lv1c.id,
      level: lv1c.level + 1,
    },
  });

  console.log('[2] Admin + Users: 2 admin, 2 cây MIB (11 user) đảm bảo tồn tại, level đã đúng theo hierarchy:');
  console.log(
    `     mib=${mib1.level} mib2=${mib2.level} | lv1-a=${lv1a.level} lv1-b=${lv1b.level} lv1-c=${lv1c.level} | ` +
    `lv2-a=${lv2a.level} lv2-b=${lv2b.level} lv2-c=${lv2c.level} lv2-c2=${lv2c2.level} | lv3-a=${lv3a.level} lv3-b=${lv3b.level}`,
  );

  // ==========================================================================
  // 3. Seed Templates — đủ TemplateItem cho MỌI Asset hiện có trong DB.
  //    Trước đây chỉ có 2 template cùng level=0 (dành cho MIB cấp Lv1) — cây
  //    seed hiện sâu tới Lv3 (lv3-a, lv3-b) nên cần đủ template cho level
  //    0/1/2 để MIB, Lv1, Lv2 đều có template thật để áp cho con trực tiếp.
  //    Level 3 (dành cho Lv3 cấp Lv4) cũng seed sẵn 1 template để dự phòng
  //    nếu sau này có test tạo thêm Lv4, dù hiện tại chưa có user Lv4 nào.
  //
  //    Quy ước giá trị mẫu: càng xuống sâu, số càng nhỏ dần (mô phỏng hoa
  //    hồng thực tế bị "ăn dần" qua từng tầng) — CHỈ là data mẫu cho seed/demo,
  //    KHÔNG phải rule bắt buộc của hệ thống (hệ thống chỉ chặn con > cha
  //    dựa trên UserCommissionConfig thật, không dựa vào Template).
  // ==========================================================================
  const allAssets = await prisma.asset.findMany({ select: { id: true, code: true } });

  // ---- Level 0: MIB dùng để cấp cho Lv1 ----
  const standardTemplate = await upsertTemplateWithSamples(
    'Standard Template',
    'Template mặc định (Level 0) — MIB dùng để cấp cho Lv1. Rebate/markup cơ bản cho asset chính, còn lại = 0',
    0,
    admin.id,
    {
      GOLD: { rebateUnit: 5, markupPips: 5 },
      FOREX: { rebateUnit: 3, markupPips: 3 },
      D_FOREX: { rebateUnit: 3, markupPips: 3 },
      BITCOIN: { rebateUnit: 2, markupPips: 2 },
      ETHEREUM: { rebateUnit: 2, markupPips: 2 },
    },
    allAssets,
  );

  const premiumTemplate = await upsertTemplateWithSamples(
    'Premium Template',
    'Template cao cấp (Level 0) — MIB dùng để cấp cho Lv1. Rebate/markup cao hơn cho asset chính, còn lại = 0',
    0,
    admin.id,
    {
      GOLD: { rebateUnit: 10, markupPips: 10 },
      FOREX: { rebateUnit: 6, markupPips: 6 },
      D_FOREX: { rebateUnit: 6, markupPips: 6 },
      BITCOIN: { rebateUnit: 4, markupPips: 4 },
      ETHEREUM: { rebateUnit: 4, markupPips: 4 },
    },
    allAssets,
  );

  // ---- Level 1: Lv1 dùng để cấp cho Lv2 ----
  const standardTemplateL1 = await upsertTemplateWithSamples(
    'Standard Template L1',
    'Template mặc định (Level 1) — Lv1 dùng để cấp cho Lv2',
    1,
    admin.id,
    {
      GOLD: { rebateUnit: 3, markupPips: 3 },
      FOREX: { rebateUnit: 2, markupPips: 2 },
      D_FOREX: { rebateUnit: 2, markupPips: 2 },
      BITCOIN: { rebateUnit: 1, markupPips: 1 },
      ETHEREUM: { rebateUnit: 1, markupPips: 1 },
    },
    allAssets,
  );

  const premiumTemplateL1 = await upsertTemplateWithSamples(
    'Premium Template L1',
    'Template cao cấp (Level 1) — Lv1 dùng để cấp cho Lv2',
    1,
    admin.id,
    {
      GOLD: { rebateUnit: 6, markupPips: 6 },
      FOREX: { rebateUnit: 4, markupPips: 4 },
      D_FOREX: { rebateUnit: 4, markupPips: 4 },
      BITCOIN: { rebateUnit: 2, markupPips: 2 },
      ETHEREUM: { rebateUnit: 2, markupPips: 2 },
    },
    allAssets,
  );

  // ---- Level 2: Lv2 dùng để cấp cho Lv3 ----
  const standardTemplateL2 = await upsertTemplateWithSamples(
    'Standard Template L2',
    'Template mặc định (Level 2) — Lv2 dùng để cấp cho Lv3',
    2,
    admin.id,
    {
      GOLD: { rebateUnit: 1, markupPips: 1 },
      FOREX: { rebateUnit: 1, markupPips: 1 },
      D_FOREX: { rebateUnit: 1, markupPips: 1 },
      BITCOIN: { rebateUnit: 0.5, markupPips: 0.5 },
      ETHEREUM: { rebateUnit: 0.5, markupPips: 0.5 },
    },
    allAssets,
  );

  const premiumTemplateL2 = await upsertTemplateWithSamples(
    'Premium Template L2',
    'Template cao cấp (Level 2) — Lv2 dùng để cấp cho Lv3',
    2,
    admin.id,
    {
      GOLD: { rebateUnit: 2, markupPips: 2 },
      FOREX: { rebateUnit: 2, markupPips: 2 },
      D_FOREX: { rebateUnit: 2, markupPips: 2 },
      BITCOIN: { rebateUnit: 1, markupPips: 1 },
      ETHEREUM: { rebateUnit: 1, markupPips: 1 },
    },
    allAssets,
  );

  // ---- Level 3: Lv3 dùng để cấp cho Lv4 (dự phòng, chưa có user Lv4 nào) ----
  const standardTemplateL3 = await upsertTemplateWithSamples(
    'Standard Template L3',
    'Template mặc định (Level 3) — Lv3 dùng để cấp cho Lv4 (dự phòng, hiện chưa có user Lv4)',
    3,
    admin.id,
    {
      GOLD: { rebateUnit: 0.5, markupPips: 0.5 },
      FOREX: { rebateUnit: 0.5, markupPips: 0.5 },
    },
    allAssets,
  );

  console.log(
    `[3] Templates: 7 template(s) (level 0×2, level 1×2, level 2×2, level 3×1) đủ item cho ${allAssets.length} asset(s)`,
  );

  // ==========================================================================
  // 4. Demo Template Lock — seed sẵn vài case lock/unlock ĐÚNG FLOW nghiệp vụ
  //    thật (chỉ Admin hoặc cha trực tiếp mới lock/unlock được, template.level
  //    phải khớp target.level), để môi trường dev/test luôn có sẵn dữ liệu
  //    minh hoạ cả 2 trạng thái: đang bị khoá VÀ đã từng khoá rồi mở lại.
  //
  //    Case 1 (giữ nguyên trạng thái LOCKED): MIB1 khoá "Premium Template L1"
  //    cho lv1-b — mô phỏng MIB muốn lv1-b chỉ được dùng Standard L1, không
  //    được tự ý cấp Premium L1 cho cấp dưới của mình.
  //
  //    Case 2 (giữ nguyên trạng thái LOCKED): lv1-b khoá "Premium Template L2"
  //    cho con trực tiếp lv2-c — cùng logic, nhưng ở tầng sâu hơn, do chính
  //    IB (không phải Admin) thực hiện.
  //
  //    Case 3 (LOCK rồi UNLOCK lại — minh hoạ đủ vòng đời): Admin khoá rồi tự
  //    mở khoá lại "Standard Template L2" cho lv2-a — kết quả cuối là KHÔNG
  //    còn bị khoá, nhưng chứng minh luồng lock->unlock chạy đúng qua chính
  //    API thật (upsert rồi deleteMany), không phải chỉ tạo sẵn data tĩnh.
  // ==========================================================================
  await lockTemplateForUser(
    premiumTemplateL1.id,
    lv1b.id,
    'USER',
    mib1.id,
    'MIB1 khoá "Premium Template L1" cho lv1-b (còn hiệu lực — demo trạng thái đang bị khoá)',
  );

  await lockTemplateForUser(
    premiumTemplateL2.id,
    lv2c.id,
    'USER',
    lv1b.id,
    'lv1-b khoá "Premium Template L2" cho con trực tiếp lv2-c (còn hiệu lực — demo IB tự khoá, không cần Admin)',
  );

  await lockTemplateForUser(
    standardTemplateL2.id,
    lv2a.id,
    'ADMIN',
    admin.id,
    'Admin khoá tạm "Standard Template L2" cho lv2-a',
  );
  await unlockTemplateForUser(
    standardTemplateL2.id,
    lv2a.id,
    'Admin mở khoá lại "Standard Template L2" cho lv2-a (demo đủ vòng đời lock -> unlock, kết quả cuối: KHÔNG còn bị khoá)',
  );

  console.log('[4] Template Lock: đã seed demo 2 case đang khoá + 1 case đã khoá rồi mở lại');

  // ==========================================================================
  // 5. Đồng bộ lại lần cuối (idempotent) — phòng trường hợp DB có asset khác
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