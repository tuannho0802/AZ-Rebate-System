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
