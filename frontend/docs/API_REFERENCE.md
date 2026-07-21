# API Reference — Rebate System Backend

Nguồn chính thức, tương tác được: `http://localhost:3000/api-docs` (Swagger,
có auto-authorize sau khi login qua `public/swagger-ui-init.js`). File này là
bản tóm tắt tĩnh cho FE tra cứu nhanh, không thay thế Swagger.

**Auth chung**: mọi route (trừ `GET /`, `POST /auth/*`) cần header
`Authorization: Bearer <accessToken>`. Actor decode được từ token có shape:
```ts
{ sub: string; email: string; type: 'admin' | 'user'; role?: 'MIB' | 'IB' }
```
> ✅ **Đã sửa lại (21/7/2026)**: bản trước ghi `{ id, ..., type: 'ADMIN'|'USER' }`
> (chữ HOA) — SAI. Xác nhận qua code thật đang chạy: mọi page
> (`admin/page.tsx`, `mib/page.tsx`, `ib/page.tsx`, `sessions/page.tsx`,
> `admin/templates/page.tsx`) đều so sánh `user.type !== 'admin'` (chữ
> thường) và đọc `user.sub` (không phải `.id`), và Flow 01 (Login) đã test
> PASS với đúng redirect theo role. Nếu type thật là chữ HOA, toàn bộ guard
> lowercase này sẽ luôn fail và Admin không bao giờ vào được `/admin` — thực
> tế ngược lại. **Dùng bản này (`sub`, chữ thường) làm nguồn sự thật**, không
> phải bản ghi trước đó.

**Error format chuẩn** (mọi lỗi, qua `GlobalExceptionFilter`):
```json
{ "statusCode": 403, "message": "...", "error": "Forbidden", "timestamp": "...", "path": "/..." }
```

## Authentication

| Method | Path | Actor | Body | Response |
|---|---|---|---|---|
| POST | `/auth/admin/login` | Public | `{ email, password }` | `{ accessToken }` |
| POST | `/auth/user/login` | Public | `{ email, password }` | `{ accessToken }` |

## Admin Management (Admin-only, `AdminOnlyGuard`)

| Method | Path | Body | Ghi chú |
|---|---|---|---|
| POST | `/admin/assets` | `{ code, name, category }` | 403 nếu không phải Admin |
| GET | `/admin/assets` | — | Mở cho cả non-admin xem (list) |
| PATCH | `/admin/assets/:id` | `{ code?, name?, category?, isActive? }` | |
| DELETE | `/admin/assets/:id` | — | Bỏ qua item Template `(0,0)` khi đếm ref-count |
| POST | `/admin/templates` | `{ name, description?, items: [{assetId, rebateUnit, markupPips}] }` | Tự thêm placeholder `(0,0)` cho asset chưa liệt kê |
| GET | `/admin/templates` | — | Mở cho non-admin xem |
| PATCH | `/admin/templates/:id` | `{ name?, description?, items? }` | |
| DELETE | `/admin/templates/:id` | — | |
| POST | `/admin/users` | `{ email, password, fullName, role, parentId? }` | Admin tạo tuỳ ý bất kỳ user nào, DTO: `CreateUserDto` |

## User Management (`JwtAuthGuard`, phân quyền trong service/guard)

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| GET | `/users?page=&limit=&sort=&parentId=` | Admin: thấy tất cả. MIB/IB: subtree của mình | `limit` tối đa 100 (`@Max(100)`), vượt → 400 |
| POST | `/users` | IB tự tạo con TRỰC TIẾP; Admin tạo tuỳ ý (qua `/admin/users`) | DTO: `CreateChildUserDto` (khác `CreateUserDto` ở validation) |
| GET | `/users/:id` | Admin bất kỳ; MIB/IB trong subtree | |
| PATCH | `/users/:id` | Chỉ sửa `fullName`/`isActive`, không hard-delete | MIB **không tự sửa được chính mình** (403); chỉ cha trực tiếp sửa được con |
| GET | `/users/:id/subtree` | MIB xem được cả cháu (đã nới); IB luôn 403 dù xem chính mình | |

## Commission Config (`JwtAuthGuard`)

| Method | Path | Body/Query | Ghi chú |
|---|---|---|---|
| POST | `/commission-configs` | `{ userId, assetId, rebateUnit, markupPips }` | Xem đầy đủ rule ở `BUSINESS_RULES.md` |
| PATCH | `/commission-configs/:userId/:assetId` | `{ rebateUnit?, markupPips?, version }` | `version` BẮT BUỘC — optimistic lock, sai → 409 |
| GET | `/commission-configs/tree/:userId?assetId=` | `assetId` **CHƯA xác nhận** bắt buộc hay optional | **Admin-only**, trả cây lồng nhau đầy đủ. Xem ghi chú ⚠️ ngay dưới bảng trước khi làm Flow 06 |
| GET | `/commission-configs/children/:userId?assetId=` | `assetId` **BẮT BUỘC** | Chính mình hoặc Admin; trả `{ self, children: [] }`. Gọi thiếu `assetId` → 400 |

> ⚠️ **Đã xác nhận qua log thật (Flow 04, `test-flow04-templates.js`, 20/7/2026)**:
> `GET /commission-configs/children/:userId` yêu cầu `assetId` là query param **BẮT BUỘC**
> — dấu `?assetId=` trong path dễ khiến hiểu nhầm là optional, nhưng thực tế gọi thiếu
> sẽ bị `400`. Route `GET /commission-configs/tree/:userId` dùng cùng pattern query nên
> **nhiều khả năng cũng bắt buộc tương tự**, nhưng CHƯA được test tay/script xác nhận —
> khi làm Flow 06 (Commission Config: READ), verify lại bằng log thật trước khi coi
> `assetId` là optional, đừng suy đoán theo mô tả cũ trong file này.

Response `POST`/`PATCH` (1 record):
```json
{ "id": "...", "userId": "...", "assetId": "...", "rebateUnit": 10,
  "markupPips": 5, "transferUnit": 15, "version": 1, "createdAt": "...", "updatedAt": "..." }
```

## Payout Sessions (`JwtAuthGuard` + `AdminOnlyGuard`, toàn bộ Admin-only)

| Method | Path | Body | Ghi chú |
|---|---|---|---|
| GET | `/payout-sessions?status=` | — | Filter theo `DRAFT`/`LOCKED`/`COMPLETED` |
| POST | `/payout-sessions` | `{ name, note?, baseVolume, sourceUserId, assetId }` | Tạo ở status `DRAFT` |
| POST | `/payout-sessions/:id/lock` | — | `DRAFT → LOCKED`, sinh Ledger. Gọi lại khi đã LOCKED → 409 |
| POST | `/payout-sessions/:id/complete` | — | `LOCKED → COMPLETED`. Gọi lại → 409 |
| GET | `/payout-sessions/:id` | — | Kèm `ledgerEntries: []` nếu đã Lock |

## Ledger

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/payout-sessions/:sessionId/ledger` | Danh sách `CommissionLedger` của 1 session |

## Template Apply

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/templates/:templateId/apply/:userId` | Root: chỉ Admin. Non-root: Admin hoặc **cha trực tiếp**. Item `(0,0)` bị lọc bỏ trước khi apply — xem `BUSINESS_RULES.md` |

## Template Lock / Unlock / Visible

> ✅ **Đã xác nhận qua log thật (`test-flow-check.js`, RUN_ID=1784604666313,
> 21/7/2026, 89/89 PASS)** — 3 route này TRƯỚC ĐÂY chưa có trong tài liệu,
> nay bổ sung đầy đủ. FE cần route này cho Flow 09 (Template Apply) vì
> template bị lock sẽ không xuất hiện trong danh sách mà user đó được apply.

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| POST | `/templates/:templateId/lock/:userId` | **Cha TRỰC TIẾP** của `userId` | Khoá 1 template cụ thể khỏi tầm nhìn của 1 user. Idempotent — gọi lại khi đã lock vẫn `200/201`, không lỗi. `templateId.level` PHẢI khớp level hiện tại của `userId` — sai → `400` kèm message `"Template level=X không khớp level=Y của user này"`. Không phải cha trực tiếp (kể cả IB thường, kể cả MIB với cháu) → `403` |
| POST | `/templates/:templateId/unlock/:userId` | **Cha TRỰC TIẾP** của `userId` | Gỡ khoá, template xuất hiện lại trong `GET /templates/visible` của user đó ngay lập tức |
| GET | `/templates/visible` | Actor hiện tại (theo token) | Trả danh sách template mà actor được thấy — đã trừ các template đang bị lock riêng cho actor đó. **Admin**: thấy tất cả, kèm field `level`. **Non-admin (MIB/IB)**: KHÔNG có field `level` trong response (ẩn hoàn toàn, giống `GET /admin/templates`) |

> ⚠️ **Bằng chứng gián tiếp, chưa test API sống**: `schema.prisma` có field
> `TemplateLock.lockedByType: 'ADMIN'|'USER'` và `seed.ts` demo case Admin
> lock/unlock — gợi ý mạnh Admin CÓ bypass được cha-trực-tiếp. Nhưng seed ghi
> thẳng qua Prisma (bỏ qua Guard thật), nên đây KHÔNG phải xác nhận sống.
> Gọi thử 1 lần bằng token Admin thật trước khi build UI dựa hẳn vào đây —
> xem `BUSINESS_RULES.md` mục 3a.

## Integrity Check (Admin-only)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/admin/integrity-check` | Quét toàn DB, trả mảng vi phạm cha-con. Rỗng = sạch |

Shape 1 violation (đã verify trực tiếp từ `ChainViolation` interface trong
`integrity.service.ts` — field FLAT, không lồng nhau như suy đoán ban đầu):
```json
{
  "assetCode": "CRYPTO",
  "assetId": "...",
  "childEmail": "lv1-b@test.com",
  "childUserId": "...",
  "parentEmail": "mib@test.com",
  "parentUserId": "...",
  "childRebate": 10,
  "childMarkup": 5,
  "parentRebate": 0,
  "parentMarkup": 0,
  "violatesRebate": true,
  "violatesMarkup": true
}
```
`violatesRebate`/`violatesMarkup`: cờ boolean riêng cho từng chiều — 1 vi
phạm có thể chỉ sai `rebateUnit`, chỉ sai `markupPips`, hoặc cả 2. FE nên
dùng 2 cờ này để hiển thị đúng phần nào đang lệch, thay vì tự so sánh lại
`childRebate > parentRebate`.

## Mã lỗi cần FE xử lý riêng (không chỉ show message chung)

| Status | Khi nào gặp | UI nên làm gì |
|---|---|---|
| 400 | Vượt trần cha, hạ dưới trần con, orphan config, template rỗng/toàn placeholder, **lock template sai level so với user target** | Hiện message trả về (đã có sẵn tiếng Việt rõ ràng từ backend) |
| 403 | Không đúng cha trực tiếp, không phải Admin khi cần, IB xem subtree | Nên **ẩn action trước** dựa vào role/quan hệ cha-con, không chỉ chờ lỗi 403 |
| 404 | User/Asset/Template/Session không tồn tại | Điều hướng về danh sách |
| 409 | Version conflict (PATCH config), lock/complete session sai trạng thái | "Dữ liệu đã bị thay đổi, tải lại trang" — GET lại rồi thử tiếp |