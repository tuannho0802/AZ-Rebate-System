import { PrismaClient, Role, AssetCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Seed Assets
  const assets = [
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

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { code: asset.code },
      update: {},
      create: asset,
    });
  }

  // 2. Seed Test Users
  const passwordHash = await bcrypt.hash('Test@1234', 10);

  // Seed Admin
  const admin = await prisma.adminAccount.upsert({
    where: { email: 'admin_test@azrebate.com' },
    update: {},
    create: {
      email: 'admin_test@azrebate.com',
      passwordHash,
      fullName: 'Admin Test',
    },
  });

  // Seed MIB 1
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

  // Level 1 of MIB 1
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

  // Level 2 of MIB 1
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

  // Level 3 of MIB 1
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

  // Seed MIB 2
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

  // Level 1 of MIB 2
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

  // Level 2 of MIB 2
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
