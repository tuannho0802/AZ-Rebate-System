# Frontend Build Plan — Rebate System

Theo dõi tiến độ build FE theo từng Flow, sắp xếp từ **dễ test nhất → phức tạp
nhất**. Mỗi Flow phụ thuộc Flow trước nó đã ổn định (đặc biệt Flow 08→09→10→11
là 1 chuỗi liền, không nhảy cóc). Cập nhật cột **Trạng thái** sau mỗi lần Agent
làm xong 1 Flow, để phiên/Agent sau biết chính xác đang ở đâu mà không cần hỏi
lại từ đầu.

**Trạng thái dùng chung**: `Chưa làm` / `Đang làm` / `Xong — chưa test` /
`Đã test — PASS` / `Đã test — có bug (xem ghi chú)`.

Tham chiếu chéo: [`API_REFERENCE.md`](./API_REFERENCE.md) cho path/body/response,
[`BUSINESS_RULES.md`](./BUSINESS_RULES.md) cho logic phải implement đúng,
[`FRONTEND_CONVENTIONS.md`](./FRONTEND_CONVENTIONS.md) cho cấu trúc code.

---

## Flow 01 — Login (Admin + User)

**Trạng thái:** Đã test — PASS
**API dùng:** `POST /auth/admin/login`, `POST /auth/user/login`
**Component:** `login/page.tsx`, `auth-context.tsx` (đã có, chỉ cần verify)

### Checklist test
- [x] Login đúng email/password Admin → vào được `/admin`
- [x] Login đúng email/password User (MIB) → vào được `/mib`
- [x] Login đúng email/password User (IB) → vào được `/ib`
- [x] Login sai password → hiện lỗi rõ ràng, không crash
- [x] Login email không tồn tại → hiện lỗi rõ ràng
- [x] Token lưu đúng cookie, refresh trang vẫn còn đăng nhập
- [x] Logout xoá đúng cookie, redirect về `/login`

---

## Flow 02 — Admin: Asset CRUD

**Trạng thái:** Đã test — PASS
**API dùng:** `POST/GET/PATCH/DELETE /admin/assets`
**Component đề xuất:** `AssetTable`, `AssetFormDialog`

### Checklist test
- [x] List asset hiện đúng, kể cả `isActive=false` (có đánh dấu rõ — badge "Ngừng hoạt động")
- [x] Tạo asset mới → xuất hiện ngay trong list
- [x] Tạo asset trùng `code` → hiện lỗi rõ ràng
- [x] Sửa asset (đổi `name`/`category`/`isActive`) → cập nhật đúng
- [x] Xoá asset → biến mất khỏi list
- [x] Non-admin (MIB/IB) không thấy nút Create/Edit/Delete (chỉ xem list, vì `GET` mở công khai)

### Bổ sung (sau khi hoàn thành)
- [x] Asset List view-only được thêm vào `/mib` và `/ib` — dùng `AssetTable` với `isAdmin=false`

---

## Flow 03 — Admin: Users list + tạo User

**Trạng thái:** Chưa làm
**API dùng:** `GET /users` (pagination, filter `parentId`), `POST /admin/users`
**Component đề xuất:** `UserTable`, `UserFormDialog`

### Checklist test
- [ ] List user phân trang đúng (`page`, `limit`)
- [ ] `limit=101` → báo lỗi 400 (không cho gửi quá 100)
- [ ] Filter theo `parentId` → chỉ hiện đúng con trực tiếp
- [ ] Admin tạo MIB mới (không `parentId`) → thành công
- [ ] Admin tạo IB mới (có `parentId`) → thành công
- [ ] Tạo user email trùng → hiện lỗi rõ ràng

---

## Flow 04 — Admin: Template CRUD

**Trạng thái:** Chưa làm
**API dùng:** `POST/GET/PATCH/DELETE /admin/templates`
**Component đề xuất:** `TemplateTable`, `TemplateFormDialog` (form thêm nhiều `TemplateItem`)

### Checklist test
- [ ] Tạo template với 1-2 item cụ thể → thành công
- [ ] Sau khi tạo, xem chi tiết → thấy các asset KHÔNG liệt kê tự động có item `(0,0)` (placeholder)
- [ ] UI phân biệt rõ item Admin cố ý set vs item placeholder tự sinh (không để lẫn lộn)
- [ ] Sửa template (đổi `name`/`items`) → cập nhật đúng
- [ ] Xoá template → biến mất khỏi list

---

## Flow 05 — Integrity Check panel

**Trạng thái:** Chưa làm
**API dùng:** `GET /admin/integrity-check`
**Component đề xuất:** `IntegrityCheckPanel`

### Checklist test
- [ ] Admin gọi → hiện đúng danh sách vi phạm (nếu có)
- [ ] Non-admin gọi → 403, không thấy trang này (ẩn menu luôn, không chỉ chặn API)
- [ ] Mỗi dòng vi phạm hiện đúng `childEmail`/`parentEmail`/`assetCode`
- [ ] Dùng đúng cờ `violatesRebate`/`violatesMarkup` để highlight phần nào sai (không tự so sánh lại số)
- [ ] Danh sách rỗng → hiện "Không có vi phạm" thay vì bảng trống khó hiểu

---

## Flow 06 — Commission Config: READ (tree + children)

**Trạng thái:** Chưa làm
**API dùng:** `GET /commission-configs/tree/:userId`, `GET /commission-configs/children/:userId`
**Component đề xuất:** `CommissionTreeView` (Admin), `CommissionChildrenPanel` (MIB/IB)

### Checklist test
- [ ] Admin xem `tree/:userId` → render đúng cây lồng nhau nhiều tầng
- [ ] Non-admin gọi `tree/:userId` → 403 (route Admin-only)
- [ ] MIB xem `children/:mibId` → thấy đúng bản thân + con trực tiếp, KHÔNG thấy cháu
- [ ] IB xem `children` của chính mình → OK; xem của người khác → 403
- [ ] Node chưa có config hiện `null`/"chưa cấu hình" thay vì `0` (tránh hiểu nhầm đã set 0)

---

## Flow 07 — Users: subtree view + PATCH

**Trạng thái:** Chưa làm
**API dùng:** `GET /users/:id/subtree`, `PATCH /users/:id`
**Component đề xuất:** dùng lại `UserTable`, thêm `UserSubtreeView`

### Checklist test
- [ ] MIB xem subtree của chính mình → 200, hiện cả cháu
- [ ] MIB xem subtree của user khác nhánh (MIB khác) → 403
- [ ] IB xem subtree bất kỳ (kể cả chính mình) → LUÔN 403 — UI phải ẩn hẳn nút này với IB
- [ ] MIB sửa `fullName`/`isActive` của con trực tiếp → 200
- [ ] MIB sửa cháu (không phải con trực tiếp) → 403
- [ ] MIB tự sửa chính mình → LUÔN 403 (UI nên disable nút Edit trên chính hàng của MIB)

---

## Flow 08 — Commission Config: WRITE (upsert/update) ⚠️ Phức tạp nhất tầng đơn lẻ

**Trạng thái:** Chưa làm
**API dùng:** `POST /commission-configs`, `PATCH /commission-configs/:userId/:assetId`
**Component đề xuất:** `CommissionConfigForm`, `VersionConflictBanner`

### Checklist test — bám sát BUSINESS_RULES.md mục 2
- [ ] Admin set config gốc cho MIB (root) → 200/201
- [ ] MIB tự set config cho chính mình (root) → 403 (chỉ Admin set được root)
- [ ] MIB set config con trực tiếp, trong trần cha → 200/201
- [ ] MIB set config con trực tiếp, VƯỢT trần cha (rebateUnit) → 400
- [ ] MIB set config con trực tiếp, VƯỢT trần cha (markupPips) → 400 (test riêng biệt 2 field)
- [ ] MIB set config cho CHÁU (không phải con trực tiếp) → 403
- [ ] Set config con khi CHA TRỰC TIẾP chưa có config asset đó → 400 (orphan)
- [ ] Admin hạ giá trị MIB (root) XUỐNG DƯỚI mức con trực tiếp đang giữ → 400 (trần dưới)
- [ ] Admin hạ giá trị MIB xuống ĐÚNG BẰNG mức con → 200 (boundary hợp lệ)
- [ ] PATCH với `version` sai → 409, UI hiện `VersionConflictBanner` + nút "Tải lại"
- [ ] PATCH với `version` đúng (sau khi tải lại) → 200
- [ ] Sau mọi lần bị 400/403/409, verify `version` KHÔNG đổi (refetch xác nhận)

---

## Flow 09 — Template Apply

**Trạng thái:** Chưa làm
**Phụ thuộc:** Flow 08 phải ổn định trước (dùng chung logic `upsert`)
**API dùng:** `POST /templates/:templateId/apply/:userId`
**Component đề xuất:** `TemplateApplyDialog`

### Checklist test
- [ ] MIB tự áp template cho chính mình (root) → 403
- [ ] Admin áp template cho MIB (root) → 201, bypass cap/orphan check
- [ ] MIB áp template cho con trực tiếp (đã có config gốc) → 201
- [ ] MIB áp template cho cháu → 403
- [ ] Preview trước khi áp: item `(0,0)` placeholder hiện rõ "sẽ KHÔNG được áp dụng"
- [ ] Sau khi áp, verify đúng số item thực sự được ghi (không tính placeholder)

---

## Flow 10 — Payout Session (create/lock/complete)

**Trạng thái:** Chưa làm
**Phụ thuộc:** Flow 08 đã có config chain hợp lệ cho asset định test
**API dùng:** `GET/POST /payout-sessions`, `POST /payout-sessions/:id/lock`, `POST /payout-sessions/:id/complete`
**Component đề xuất:** `PayoutSessionStatusBadge`, `PayoutSessionActions`

### Checklist test
- [ ] Non-admin tạo session → 403
- [ ] Admin tạo session (DRAFT) → 201
- [ ] List session, filter theo `status` → đúng
- [ ] Lock session (DRAFT→LOCKED) → 200/201, nút Lock tự disable sau đó
- [ ] Lock lại session đã LOCKED → 409 (nút phải đã disable từ trước, không cho bấm lại)
- [ ] Complete session (LOCKED→COMPLETED) → 200/201, nút Complete tự disable
- [ ] Complete lại session đã COMPLETED → 409
- [ ] Lock session đã COMPLETED → 409

---

## Flow 11 — Ledger view + verify Net-Pips ⚠️ Phức tạp nhất tổng thể

**Trạng thái:** Chưa làm
**Phụ thuộc:** Flow 08 → 09 → 10 chạy đúng theo thứ tự
**API dùng:** `GET /payout-sessions/:sessionId/ledger`, `GET /payout-sessions/:id`
**Component đề xuất:** `LedgerTable`

### Checklist test
- [ ] Sau khi Lock, `ledgerEntries[]` xuất hiện đúng số dòng (bằng số node active trong ancestor chain)
- [ ] **Dựng đúng kịch bản kiểm chứng thuật toán**: A(active,20) → B(inactive,15) → C(active,10),
      source=C → verify UI hiện đúng `Net(A) = 10` (không phải 5 hay 20)
- [ ] Node inactive KHÔNG xuất hiện trong ledger (bị nhảy qua hoàn toàn)
- [ ] Số liệu hiển thị đúng định dạng số thập phân (Decimal từ backend), không bị làm tròn sai do parse JS `number`

---

## Ghi chú cho Agent khi cập nhật file này

- Sau khi hoàn thành 1 Flow, đổi **Trạng thái** ở đầu mục, KHÔNG xoá checklist
  (giữ lại để phiên sau biết đã test những gì).
- Nếu phát hiện bug khi test, tick `[x]` vào đúng dòng nhưng ghi thêm
  `⚠️ BUG: <mô tả ngắn>` ngay dưới dòng đó, không tự ý sửa business logic
  backend nếu chưa xác nhận — báo lại để review trước (theo đúng tinh thần
  các phiên trước: không tự đơn giản hoá rule khi chưa xác nhận).
- Không nhảy sang Flow 09-11 nếu Flow 08 còn dòng nào chưa tick — chuỗi này
  phụ thuộc chặt vào nhau, làm tắt sẽ khó debug về sau khi lỗi xuất hiện ở
  tầng Ledger nhưng nguyên nhân thực ra nằm ở Config từ trước đó rất xa.