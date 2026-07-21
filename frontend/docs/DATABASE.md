# Database — Rebate System

PostgreSQL + Prisma. Xem `prisma/schema.prisma` là nguồn sự thật cuối cùng —
file này chỉ tóm tắt để tra cứu nhanh.

## 1. Model chính (tóm tắt quan hệ)

- **AdminAccount** — actor ngoài cây phân cấp, quản Asset/Template/User.
  Không có `parentId`, độc lập với `User`.
- **User** — dùng chung 1 bảng cho MIB (root) và IB (nhiều cấp). Phân biệt
  bằng `parentId`: `null` = MIB root, không null = IB con. Có `isActive`
  (không hard-delete, chỉ toggle).
- **Asset** — loại tài sản tính hoa hồng (VD `GOLD`, `CRYPTO`...). Có
  `isActive`, mã `code` duy nhất.
- **UserCommissionConfig** — config hoa hồng của 1 User cho 1 Asset.
  `@@unique([userId, assetId])`. Field: `rebateUnit`, `markupPips`,
  `transferUnit` (= 2 field trên cộng lại), `version` (optimistic lock).
- **Template** + **TemplateItem** — bộ cấu hình mẫu, mỗi `TemplateItem` gắn
  1 `assetId` + `rebateUnit`/`markupPips`. Khi tạo/update Template,
  `admin.service.ts` tự động thêm placeholder `(0,0)` cho MỌI asset chưa
  được liệt kê — xem `BUSINESS_RULES.md` mục Template Apply để hiểu tác động.
- **TemplateLock** — bảng quan hệ ẩn 1 `Template` khỏi 1 `User` cụ thể (xem
  `BUSINESS_RULES.md` mục 3a). ✅ Đã xác nhận qua `schema.prisma`:
  ```prisma
  model TemplateLock {
    id           String   @id @default(uuid())
    templateId   String
    userId       String        // user bị khoá không dùng được template này
    lockedByType String        // 'ADMIN' | 'USER' — actor đã thực hiện lock
    lockedById   String
    createdAt    DateTime @default(now())

    @@unique([templateId, userId])  // 1 user chỉ tối đa 1 row lock / template
    @@index([userId])
  }
  ```
  `lockedByType`/`lockedById` chỉ dùng để lưu vết audit AI đã lock (không có
  logic đọc lại 2 field này ở guard) — **không suy ra từ đây** rằng Admin
  chắc chắn bypass được cha-trực-tiếp; xem cảnh báo ở `BUSINESS_RULES.md`
  mục 3a về mức độ tin cậy của bằng chứng này.
- **PayoutSession** — state machine `DRAFT → LOCKED → COMPLETED`. Field:
  `name`, `note`, `baseVolume`, `sourceUserId`, `assetId`, `status`,
  `createdByAdminId`.
- **CommissionLedger** — sinh ra lúc Lock 1 PayoutSession, 1 dòng cho mỗi
  user trong ancestor chain còn active. Field: `payoutSessionId`,
  `beneficiaryId`, `assetId`, `netRebate`, `netMarkup`, `netTransferUnit`,
  `calculatedValue`. Có CHECK constraint DB-level chặn giá trị âm.
- **AuditLog** — ghi mọi mutation tài chính. `actorAdminId`/`actorUserId`
  (1 trong 2 null tuỳ actor), `action`, `entityType`, `entityId`,
  `beforeData`/`afterData` (JSON).

## 2. Migration

```powershell
npx prisma migrate dev --name <mô_tả_thay_đổi>
npx prisma generate
```

Xem trạng thái migration hiện tại: `npx prisma migrate status`.

## 3. Seed dữ liệu

```powershell
npx prisma db seed
```

(hoặc `npx ts-node prisma/seed.ts` tuỳ cách seed script được đăng ký trong
`package.json`).

### Account seed cố định (password chung: `Test@1234`)

| Email | Loại | Vai trò trong cây |
|---|---|---|
| `admin_test@azrebate.com` | AdminAccount | Admin chính |
| `admin2_test@azrebate.com` | AdminAccount | Admin phụ (test non-root admin) |
| `mib@test.com` | User (MIB, root) | Gốc cây 1 |
| `lv1-a@test.com` | User (IB) | Con trực tiếp của `mib` |
| `lv1-b@test.com` | User (IB) | Con trực tiếp của `mib` |
| `lv2-a@test.com` | User (IB) | Con của `lv1-a` (cháu của `mib`) |
| `lv2-b@test.com` | User (IB) | Con của `lv1-a` |
| `lv2-c@test.com` | User (IB) | Con của `lv1-b` |
| `lv3-a@test.com`, `lv3-b@test.com` | User (IB) | Con của `lv2-a` |
| `mib2@test.com` | User (MIB, root) | Gốc cây 2 — **tách biệt hoàn toàn** với cây `mib` |
| `lv1-c@test.com` | User (IB) | Con trực tiếp của `mib2` |
| `lv2-c2@test.com` | User (IB) | Con của `lv1-c` |

Cây đầy đủ:
```
mib@test.com (MIB root)
├── lv1-a@test.com
│   ├── lv2-a@test.com
│   │   ├── lv3-a@test.com
│   │   └── lv3-b@test.com
│   └── lv2-b@test.com
└── lv1-b@test.com
    └── lv2-c@test.com

mib2@test.com (MIB root — cây RIÊNG)
└── lv1-c@test.com
    └── lv2-c2@test.com
```

Asset: 18 dòng đã seed (bao gồm `GOLD`). Lấy danh sách đầy đủ bằng SQL ở
mục 4 bên dưới.

## 4. Lấy ID chính xác (không đọc UUID bị cắt trên Prisma Studio UI)

```powershell
psql -d rebate_system_db -c "SELECT id, email, ""parentId"" FROM ""User"" ORDER BY email;"
psql -d rebate_system_db -c "SELECT id, code FROM ""Asset"" ORDER BY code;"
psql -d rebate_system_db -c "SELECT id, name FROM ""Template"";"
```

Hoặc `npx prisma studio` để xem trực quan (nhưng copy ID qua `psql` để tránh
gõ nhầm do UUID bị truncate trên UI).

## 5. Dọn dữ liệu lệch cha-con (nếu Integrity Check báo còn vi phạm)

An toàn: chỉ NÂNG cha lên bằng đúng mức con cao nhất đang giữ trực tiếp,
không đụng cha nào đang hợp lệ, không xoá gì:

```sql
UPDATE "UserCommissionConfig" AS parent_cfg
SET
  "rebateUnit" = GREATEST(parent_cfg."rebateUnit", child_max."maxRebate"),
  "markupPips" = GREATEST(parent_cfg."markupPips", child_max."maxMarkup"),
  "transferUnit" = GREATEST(parent_cfg."rebateUnit", child_max."maxRebate")
                 + GREATEST(parent_cfg."markupPips", child_max."maxMarkup"),
  version = parent_cfg.version + 1
FROM (
  SELECT
    parent_u.id AS "parentUserId",
    child_cfg."assetId",
    MAX(child_cfg."rebateUnit") AS "maxRebate",
    MAX(child_cfg."markupPips") AS "maxMarkup"
  FROM "UserCommissionConfig" child_cfg
  JOIN "User" child_u ON child_u.id = child_cfg."userId"
  JOIN "User" parent_u ON parent_u.id = child_u."parentId"
  GROUP BY parent_u.id, child_cfg."assetId"
) AS child_max
WHERE parent_cfg."userId" = child_max."parentUserId"
  AND parent_cfg."assetId" = child_max."assetId"
  AND (parent_cfg."rebateUnit" < child_max."maxRebate"
       OR parent_cfg."markupPips" < child_max."maxMarkup");
```

Sau khi chạy, verify lại bằng `GET /admin/integrity-check` (Admin token) —
kỳ vọng mảng trả về rỗng. Nếu vẫn còn vi phạm, khả năng cao là cha **chưa hề
có dòng config nào** (không phải chỉ thấp hơn con) — trường hợp này câu SQL
trên KHÔNG tự tạo dòng mới, cần xử lý tay qua `POST /commission-configs`
(Admin token) để tạo config gốc trước.

## 6. Script kiểm tra vòng lặp cha-con (dev-only, không phải API)

`backend/scripts/check-cycle.ts` (hoặc vị trí tương đương) — **khác** với
`GET /admin/integrity-check` (endpoint đó kiểm tra *giá trị* config cha-con
có bị lệch không, KHÔNG kiểm tra cấu trúc cây). Script này duyệt toàn bộ
`User.parentId` bằng con trỏ tuần tự (không đệ quy CTE), phát hiện nếu có
vòng lặp thật sự trong cây phân cấp (VD do sửa tay `parentId` qua SQL trực
tiếp gây A→B→A). Chạy tay bằng `npx ts-node scripts/check-cycle.ts` khi nghi
ngờ dữ liệu bị hỏng cấu trúc cây sau khi thao tác SQL thủ công — không có
route API tương ứng, không phải thứ FE gọi.