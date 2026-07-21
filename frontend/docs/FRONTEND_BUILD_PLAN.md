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

> ℹ️ **Script regression tổng hợp mới**: `backend/test/test-flow-check.js`
> (khác với các script `test-flow0X-*.js` theo từng Flow riêng lẻ) chạy LẠI
> TOÀN BỘ các luồng chính (Auth, Users, Commission Config, Template
> Apply/Lock/Unlock, Payout Session/Ledger, Integrity Check) trong 1 lần —
> dùng để regression-test nhanh sau khi sửa backend, không thay thế các
> script theo Flow. Lần chạy gần nhất (RUN_ID=1784604666313, 21/7/2026):
> **89/89 PASS**. Lần chạy này đồng thời phát hiện 1 tính năng backend hoàn
> toàn mới chưa có Flow nào theo dõi — xem **Flow 09b** bên dưới.

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

**Trạng thái:** Đã test — PASS
**API dùng:** `GET /users` (pagination, filter `parentId`), `POST /admin/users`
**Component:** `UserTable`, `UserFormDialog`, route `/admin/users`

### Checklist test
- [x] List user phân trang đúng (`page`, `limit`) — verify qua `test-flow03-users.js` (GET /users trả đúng mảng theo `page`/`limit`); ⚠️ CHƯA verify riêng "trang 2 khác trang 1" bằng thao tác tay bấm Next trên UI, chỉ mới test `page=1`
- [x] `limit=101` → báo lỗi 400 (không cho gửi quá 100) — PASS qua script, log thật
- [x] Filter theo `parentId` → chỉ hiện đúng con trực tiếp — PASS qua script (verify cả 2 chiều: con có mặt, cha không lẫn vào)
- [x] Admin tạo MIB mới (không `parentId`) → thành công — PASS qua script
- [x] Admin tạo IB mới (có `parentId`) → thành công — PASS qua script
- [x] Tạo user email trùng → hiện lỗi rõ ràng — PASS ở tầng API (400 + message); ⚠️ CHƯA xác nhận bằng mắt là message có hiện đúng trong `UserFormDialog` trên UI thật hay không (code review thấy đúng logic `setError(err.body.message)`, nhưng chưa thao tác tay confirm)

### Bug đã gặp và fix trong quá trình làm Flow này
- ⚠️ BUG (đã fix): Route conflict `/admin` vs `/admin/users` — `admin/page.tsx` vẫn tự render form+list User cũ song song route mới, gây trùng lặp khi vào `/admin`. Fix: thay bằng card redirect, cùng pattern với Assets/Templates.
- ⚠️ BUG (đã fix): Runtime TypeError `Cannot read properties of undefined (reading 'length')` tại `UserTable` — nguyên nhân là `listUsers()` kỳ vọng response dạng `{data, total, page, limit}` nhưng API thật trả **mảng thẳng**. Fix: `listUsers()` trả `User[]` trực tiếp, bỏ hẳn type `PaginatedUsers`; phân trang UI đổi sang heuristic `hasMore` (mảng đủ `limit` phần tử ⇒ có thể còn trang sau), vì backend không trả `total`.
- ⚠️ BUG BẢO MẬT (đã fix, ở backend): `GET /users` từng trả cả field `passwordHash` (bcrypt hash) cho FE. Fix trong `UsersService`: thêm hàm `toSafeUser()` loại `passwordHash` khỏi **mọi** response trả client (`findAll`, `findOne`, `create`, `update`), và khỏi dữ liệu ghi vào `AuditLog`. Verify lại qua `test-flow03-users.js` — response không còn field này.

---

## Flow 04 — Admin: Template CRUD

**Trạng thái:** Đã test — PASS
**API dùng:** `POST/GET/PATCH/DELETE /admin/templates`
**Component đề xuất:** `TemplateTable`, `TemplateFormDialog` (form thêm nhiều `TemplateItem`)

### Checklist test
- [x] Tạo template với 1-2 item cụ thể → thành công — PASS qua script `test-flow04-templates.js` (test 3) + tay trên UI
- [x] Sau khi tạo, xem chi tiết → thấy các asset KHÔNG liệt kê tự động có item `(0,0)` (placeholder) — PASS qua script (test 4a-4c, verify đúng số lượng = tổng asset hệ thống) + tay trên UI
- [x] UI phân biệt rõ item Admin cố ý set vs item placeholder tự sinh (không để lẫn lộn) — PASS tay trên UI (badge "Admin đã set" vs "Placeholder — không áp dụng khi Apply")
- [x] Sửa template (đổi `name`/`items`) → cập nhật đúng — PASS qua script (test 5a-5d, xác nhận PATCH 1 item KHÔNG làm đổi các item khác) + tay trên UI
- [x] Xoá template → biến mất khỏi list — PASS qua script (test 10a-10b) + tay trên UI

### Bổ sung (sau khi hoàn thành)
- Test API 20/20 PASS qua script `test-flow04-templates.js` (đã có sẵn trong `backend/test/`, chạy lại được bất kỳ lúc nào để regression test). Ngoài checklist gốc, script còn verify thêm: Apply Template lọc bỏ đúng item `(0,0)` placeholder (chỉ ghi item Admin thực sự set), xoá asset đang bị Template tham chiếu (item khác `0,0`) → 400 đúng như spec.
- "Áp dụng Template" (Admin, bypass cap/orphan) đã dời từ tab Commission Configs sang route `/admin/templates` — xem `FRONTEND_CONVENTIONS.md` nếu cần đối chiếu lý do.

### ⚠️ Phát hiện quan trọng cho Flow 06 (Commission Config: READ)
Trong lúc viết test Flow 04, phát hiện `GET /commission-configs/children/:userId` yêu cầu **`assetId` là query param BẮT BUỘC**, không phải optional như dấu `?` trong `API_REFERENCE.md` dễ gây hiểu lầm — gọi thiếu `assetId` → 400. Rất có thể `GET /commission-configs/tree/:userId` (dùng ở Flow 06) cũng bị yêu cầu tương tự vì cùng pattern route. **Khi làm Flow 06, verify lại bằng log thật trước khi coi `assetId` là optional** — đừng suy đoán theo tài liệu cũ. Nên cập nhật lại `API_REFERENCE.md` mục Commission Config để ghi rõ `assetId` bắt buộc hay optional cho từng route, tránh lặp lại nhầm lẫn này.

---

## Flow 05 — Integrity Check panel

**Trạng thái:** Đã test — PASS
**API dùng:** `GET /admin/integrity-check`
**Component đề xuất:** `IntegrityCheckPanel`

### Checklist test
- [x] Admin gọi → hiện đúng danh sách vi phạm (nếu có) — PASS qua script `test-flow05-integrity.js` (9/9, RUN_ID=1784538012083: 2 vi phạm CRYPTO + GAUCNH, shape FLAT đúng interface `ChainViolation`) + xác nhận tay trên UI (đúng 2 dòng render)
- [x] Non-admin gọi → 403, không thấy trang này (ẩn menu luôn, không chỉ chặn API) — API 403 PASS qua script; ⚠️ CHƯA xác nhận tay phần ẩn menu tab trong `admin/page.tsx` và redirect khi non-admin gõ thẳng URL `/admin/integrity-check`
- [x] Mỗi dòng vi phạm hiện đúng `childEmail`/`parentEmail`/`assetCode` — PASS tay trên UI (screenshot: CRYPTO/lv1-b@test.com/mib@test.com, GAUCNH/phela101990@gmail.com/mib2@test.com)
- [x] Dùng đúng cờ `violatesRebate`/`violatesMarkup` để highlight phần nào sai (không tự so sánh lại số) — PASS tay trên UI (cả 2 dòng đều tô đỏ 2 cột kèm "⚠ lệch", khớp đúng cờ backend trả)
- [ ] Danh sách rỗng → hiện "Không có vi phạm" thay vì bảng trống khó hiểu — CHƯA test được vì DB hiện có sẵn 2 vi phạm thật (CRYPTO, GAUCNH); code đã có nhánh xử lý (`violations.length === 0 → "✓ Không có vi phạm"` trong `IntegrityCheckPanel.tsx`), verify tay sau khi dọn 2 vi phạm này (theo DATABASE.md mục 5) hoặc test riêng trên môi trường DB sạch

### Ghi chú
- Test API 9/9 PASS qua script `test-flow05-integrity.js` (đã có sẵn trong `backend/test/`, chạy lại được để regression test — tự tạo User MIB test riêng theo `RUN_ID` để lấy token non-admin, không phụ thuộc credentials có sẵn ngoài Admin).
- Verify thêm: gọi `/admin/integrity-check` không kèm token → `401` (chưa có trong bảng lỗi `API_REFERENCE.md`, nên bổ sung).
- Endpoint hiện tại chỉ đọc (read-only check) — chưa có action dọn/sửa vi phạm trực tiếp từ panel, đúng quyết định ban đầu (không thêm link/action tới DATABASE.md mục 5, chỉ hiện danh sách).

---

## Flow 06 — Commission Config: READ (tree + children)

**Trạng thái:** ✅ Xong — UI đã làm + test API đã chạy thật, 29/29 PASS.
**API dùng:** `GET /commission-configs/tree/:userId`, `GET /commission-configs/children/:userId`
**Component:** `app/config/page.tsx` (Admin) + `CommissionManager.tsx` (MIB/IB).
**Test:** `backend/test/test-flow06-config.js` — đã chạy thật trên môi trường dev, 29 PASS / 0 FAIL.

### Checklist test
- [x] Admin xem `tree/:userId` → render đúng cây lồng nhau nhiều tầng — confirm (MIB→IB1→IB2, 3 tầng)
- [x] Non-admin gọi `tree/:userId` → 403 (route Admin-only) — confirm
- [x] MIB xem `children/:mibId` → thấy đúng bản thân + con trực tiếp, KHÔNG thấy cháu — confirm
- [x] IB xem `children` của chính mình → OK; xem của người khác → 403 — confirm
- [x] Node chưa có config hiện `null` thay vì `0` — confirm (IB2 và assetB đều trả null đúng)

### Ghi chú
- Login non-admin (MIB/IB) đúng là `POST /auth/user/login` (không phải `/auth/login` như đoán ban đầu) — đã sửa và confirm.
- `PARENT_FIELD = 'parentId'` khi tạo user qua `POST /admin/users` — confirm đúng.
- Script giữ nguyên cơ chế tự thử nhiều path (`LOGIN_PATH_CANDIDATES`) làm fallback, phòng route đổi sau này.

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
- [ ] Danh sách Template cho user tự chọn áp PHẢI lấy từ `GET
      /templates/visible` (không phải `GET /admin/templates`) — nếu không,
      user có thể tự áp cả template đang bị cha khoá. Xem Flow 09b.

### Ghi chú
- API các bước trên đã PASS qua regression `test-flow-check.js` (mục "4.
  TEMPLATE APPLY", 10/10) — backend sẵn sàng, phần còn lại là build UI theo
  đúng checklist.

---

## Flow 09b — Template Lock / Unlock (cha khoá template cho con) — MỚI

**Trạng thái:** Chưa làm (mới phát hiện qua regression, chưa từng có trong kế hoạch)
**Phát hiện qua:** `test-flow-check.js`, RUN_ID=1784604666313, 21/7/2026, mục
"7. TEMPLATE LOCK" — 14/14 PASS (backend đã có sẵn, hoạt động đúng)
**API dùng:** `POST /templates/:templateId/lock/:userId`,
`POST /templates/:templateId/unlock/:userId`, `GET /templates/visible`
**Business rule:** xem `BUSINESS_RULES.md` mục 3a (mới thêm)
**Component đề xuất:** `TemplateLockToggle` (nút trong `UserTable` hoặc
`TemplateTable`, tuỳ hướng UX chọn — xem TODO bên dưới), dùng chung
`lib/api/template.ts` (thêm hàm `lockTemplate`/`unlockTemplate`/`listVisible`)

### Vì sao cần Flow riêng
Đây KHÔNG phải một phần của Flow 09 (Apply) dù dùng chung route
`/templates`— đây là quyền **ẩn/hiện** 1 template khỏi 1 user cụ thể, độc
lập với việc apply. Flow 09 (Apply) đã lên kế hoạch từ trước nhưng chưa hề
biết tới cơ chế lock này, nên checklist Flow 09 gốc KHÔNG đủ để build đúng
màn hình chọn template cho user tự áp — cần Flow này trước hoặc song song.

### Checklist test (chưa làm ở FE, backend đã xác nhận qua script)
- [ ] Cha trực tiếp (MIB/IB) lock 1 template cho con trực tiếp → 200/201
- [ ] Gọi lock lần 2 khi đã lock → vẫn 200/201 (idempotent, không hiện lỗi)
- [ ] Cha (MIB) lock cho cháu (không phải con trực tiếp) → 403, ẩn hẳn nút
      với UI (không chỉ disable)
- [ ] IB không liên quan cố lock cho ai đó → 403
- [ ] Lock template SAI level so với level user target → 400, hiện message
      backend trả về rõ ràng; form chọn template để lock nên LỌC SẴN theo
      đúng level của user, tránh để user chọn rồi mới báo lỗi
- [ ] Sau khi lock: user bị lock gọi `GET /templates/visible` → template đó
      biến mất khỏi danh sách (verify bằng cách tự thử áp — action Apply nên
      không cho chọn template đã bị ẩn)
- [ ] Unlock → template xuất hiện lại ngay trong `/templates/visible`
- [ ] Admin gọi `/templates/visible` → thấy tất cả kèm field `level`;
      non-admin gọi → KHÔNG có field `level` trong response

### TODO cần quyết định trước khi build UI
- ⚠️ Admin bypass cha-trực-tiếp: `schema.prisma` (field `lockedByType:
  'ADMIN'|'USER'`) + `seed.ts` (demo case Admin lock/unlock) gợi ý mạnh là
  CÓ, nhưng seed ghi thẳng qua Prisma nên bỏ qua Guard thật — chưa phải xác
  nhận sống. Gọi thử 1 lần bằng token Admin thật (không phải cha trực tiếp)
  trước khi quyết định có nút Lock ở `/admin/templates` hay không.
- Chưa quyết định vị trí đặt action Lock/Unlock trên UI: (a) trong màn chi
  tiết User (list các Template kèm toggle Lock/Unlock cho user đó), hay (b)
  trong màn chi tiết Template (list các User con trực tiếp kèm toggle) — cả
  2 đều gọi cùng API, chỉ khác cách trình bày. Nên hỏi lại ý định trước khi
  code component, tránh làm xong 1 hướng rồi phải làm lại.

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

### Ghi chú
- Toàn bộ state machine trên đã PASS qua regression `test-flow-check.js`
  (mục "5. PAYOUT SESSION + LEDGER", 15/15) ở tầng API — backend sẵn sàng,
  chưa có UI. Không cần re-verify logic backend, chỉ cần build đúng theo
  checklist.

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