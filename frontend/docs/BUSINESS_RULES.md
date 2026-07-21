# Business Rules — Rebate System (đã chốt, KHÔNG tự đơn giản hoá khi build FE)

File này là nguồn sự thật cho mọi logic hiển thị/validate ở FE. Nếu FE cần
disable 1 nút, show 1 cảnh báo, hay giải thích vì sao API trả lỗi — tra ở đây
trước khi tự suy đoán.

## 1. Cấu trúc actor

- **AdminAccount**: ngoài cây phân cấp. `type: 'ADMIN'` trong token.
- **User**: `type: 'USER'`, có `role: 'MIB' | 'IB'`. `parentId === null` → MIB
  (root). `parentId !== null` → IB (con, có thể nhiều tầng).
- Không hard-delete User, chỉ toggle `isActive`.

## 2. Commission Config — 2 chiều bất biến "con ≤ cha"

Với mỗi cặp `(userId, assetId)`:

### 2.1. Trần TRÊN (khi set config cho 1 user)
- MIB root: **chỉ Admin** được set/sửa config gốc. MIB không tự sửa được
  chính mình (kể cả `PATCH /users/:id` cũng chặn tự sửa).
- Non-root: chỉ **cha TRỰC TIẾP** (không phải bất kỳ ai trong ancestor chain)
  hoặc Admin được set. `rebateUnit` và `markupPips` phải **≤** giá trị tương
  ứng của cha, kiểm tra **ĐỘC LẬP từng phần** — không được bù qua bù lại
  (VD rebateUnit thấp hơn không "bù" được cho markupPips cao hơn).
- **Orphan check**: nếu cha TRỰC TIẾP chưa có config cho asset đó → 400,
  không cho tạo config con (kể cả nếu ông/bà xa hơn đã có — chỉ tính cha
  trực tiếp, đây là rule đã SIẾT LẠI so với thiết kế ban đầu "cả chuỗi lên
  root", xác nhận là quyết định nghiệp vụ chính thức).
- Admin luôn bypass toàn bộ check trần trên + orphan.

### 2.2. Trần DƯỚI (khi 1 user tự hạ giá trị của CHÍNH MÌNH)
- Nếu đã có con TRỰC TIẾP nào đang giữ giá trị cao hơn giá trị mới muốn set,
  **KHÔNG được hạ xuống dưới mức con đó đang giữ** — áp dụng cho MỌI actor,
  **kể cả Admin, kể cả root MIB** (MIB không có cha để giới hạn trên, nhưng
  vẫn bị giới hạn dưới bởi chính con của nó).
- Lý do: hạ dưới mức con sẽ gây giá trị âm khi tính Ledger lúc Lock
  PayoutSession (DB có CHECK constraint chặn ledger âm ở tầng cuối).
- Set **đúng bằng** mức con đang giữ là HỢP LỆ (không phải strictly lower).

### 2.3. Optimistic lock
- Mọi `PATCH /commission-configs/:userId/:assetId` phải gửi `version` đúng
  với giá trị hiện tại trong DB. Sai → 409. FE phải đọc `version` mới nhất
  (qua `GET .../children/:userId` hoặc response của lần ghi trước) trước khi
  cho phép sửa tiếp — không cache `version` quá lâu trên client.

## 3. Template Apply

- Khi Admin tạo/sửa Template, backend **tự động thêm placeholder `(0,0)`**
  cho MỌI asset chưa được liệt kê trong `items` — đây là quy ước sẵn có
  trong `admin.service.ts`, không phải bug.
- Khi apply Template cho 1 user, các item `(rebateUnit=0 AND markupPips=0)`
  bị **lọc bỏ, không áp dụng** — vì không phân biệt được đây là placeholder
  tự sinh hay Admin cố ý muốn "ngừng chia" qua Template. **Nếu Admin cần
  ngừng chia 1 asset cụ thể, phải làm qua `POST /commission-configs` trực
  tiếp** (set `(0,0)` thủ công), không dùng Template cho việc này.
- Quyền apply: root → chỉ Admin. Non-root → Admin hoặc **cha trực tiếp**
  của user (khớp đúng rule 2.1, không còn cho phép "bất kỳ ai trong subtree"
  như thiết kế cũ).
- Toàn bộ item trong 1 lần apply chạy trong 1 transaction — 1 item fail thì
  rollback hết, không áp dụng phần nào.

## 3a. Template Lock / Unlock — ẩn template khỏi 1 user cụ thể

> ✅ Xác nhận qua log thật `test-flow-check.js` (RUN_ID=1784604666313,
> 21/7/2026, 89/89 PASS). Đây là rule MỚI bổ sung, độc lập với rule Apply ở
> mục 3, KHÔNG ghi đè lên nhau — 1 template có thể vẫn "áp được" (nếu Admin
> gọi Apply trực tiếp) nhưng bị ẩn khỏi danh sách user đó tự chọn qua UI.

- Mục đích: cha (MIB hoặc IB) muốn NGĂN 1 user con trực tiếp của mình tự
  chọn áp 1 Template cụ thể (VD template có mức hoa hồng cao, cha không
  muốn con tự ý dùng), mà không cần xoá hẳn Template khỏi hệ thống.
- Actor được lock/unlock: **chỉ cha TRỰC TIẾP** của user bị ảnh hưởng —
  khớp đúng tinh thần rule 2.1 (không phải "bất kỳ ai trong subtree"). MIB
  lock cho cháu (không phải con trực tiếp) → 403. IB thường (không phải cha
  của target) cố lock → 403.
- **Ràng buộc level**: `template.level` phải khớp ĐÚNG level hiện tại của
  user bị lock/unlock. Lock/unlock sai level → 400, kèm message rõ
  `"Template level=X không khớp level=Y của user này"`. Đây là lý do khi
  build FE, danh sách Template cho action Lock phải được lọc theo đúng level
  của user đang chọn — không hiện tất cả Template rồi để user tự bấm nhầm.
- **Idempotent**: gọi lock khi đã lock rồi vẫn trả 200/201, không lỗi/không
  toggle nhầm thành unlock. Tương tự không có rule ngược lại được xác nhận
  cho unlock khi chưa lock (FE nên tự kiểm tra trạng thái hiện tại trước khi
  hiện nút, tránh gọi unlock thừa).
- **Hiệu lực**: sau khi lock, template đó biến mất khỏi `GET
  /templates/visible` CHỈ với token của user bị lock (không ảnh hưởng user
  khác). Sau unlock, xuất hiện lại ngay, không cần refresh gì thêm ở BE.
- `GET /templates/visible` ẩn field `level` với non-admin — cùng quy ước ẩn
  `level` đã áp dụng ở `GET /admin/templates` (mục 1, đã có từ trước).
- ⚠️ **Chưa xác nhận qua API sống**: schema xác nhận `TemplateLock` có field
  `lockedByType: 'ADMIN' | 'USER'` và `seed.ts` có demo case Admin tự
  lock/unlock — đây là **bằng chứng gián tiếp khá mạnh** rằng service có hỗ
  trợ Admin lock/unlock (bypass cha-trực-tiếp). Tuy nhiên seed ghi thẳng qua
  Prisma Client (`prisma.templateLock.upsert/deleteMany`), **bỏ qua hoàn
  toàn Guard/Controller thật** — giống hệt kiểu lỗi `level` gặp phải trước
  đây (seed "đúng" không có nghĩa API guard cũng đúng permission check).
  Trước khi build UI cho Admin tự lock/unlock, gọi thử 1 lần
  `POST /templates/:id/lock/:userId` bằng token Admin thật (không phải cha
  trực tiếp của user đó) để xác nhận sống — đừng dựa hẳn vào seed.

## 4. Payout Session — state machine

```
DRAFT --lock--> LOCKED --complete--> COMPLETED
```
- Chỉ Admin được tạo/lock/complete (không có role nào khác được).
- Lock đòi hỏi `sourceUser.isActive === true` và `asset.isActive === true`,
  nếu không → 400.
- Không thể lock lại session đã LOCKED, không thể complete lại session đã
  COMPLETED, không thể lock session đã COMPLETED — tất cả → 409.
- FE nên disable nút "Lock"/"Complete" dựa vào `status` hiện tại thay vì chỉ
  dựa vào response lỗi.

## 5. Thuật toán Net-Pips (sinh Ledger lúc Lock)

Chạy trong `LedgerService.generateForSession()`, cùng transaction với việc
đổi status → LOCKED (atomic).

1. CTE đi **LÊN** từ `sourceUserId` tới root (không phải xuống subtree).
2. **Lọc bỏ node `isActive = false`** khỏi chain — node inactive bị "nhảy
   qua" hoàn toàn, KHÔNG coi là "contribute 0". Node active cao nhất còn lại
   sau lọc tự động là "đỉnh" của phép tính, không reject session dù root gốc
   có bị lọc ra.
3. Duyệt từ đỉnh (depth cao nhất trong chain đã lọc) xuống `source`: mỗi
   node trừ đúng **1 child liền kề trong chain đã lọc** (không phải tổng tất
   cả children thật của nó — chỉ nhánh đang xét). Node đáy (`source`) nhận
   full giá trị, không trừ gì.
4. Ví dụ bắt buộc đúng: `A(active,20) → B(inactive,15) → C(active,10)`,
   source = C ⇒ **Net(A) = 20 − 10 = 10** (không phải 20−15=5 hay 20−0=20).
5. Tính bằng `Decimal`, không dùng `number` JS thường (tránh sai số).
6. Nếu bất kỳ node nào trong active chain thiếu config cho asset của
   session → 400, không sinh ledger (toàn bộ chain phải đủ config).

## 6. Audit trail

Mọi mutation tài chính (config, template apply, payout session) đều ghi
`AuditLog` với `beforeData`/`afterData` đầy đủ. FE không cần tự hiển thị
audit log ngay ở bản đầu, nhưng nên chừa chỗ (VD trang "Lịch sử thay đổi")
vì dữ liệu đã sẵn có ở backend.