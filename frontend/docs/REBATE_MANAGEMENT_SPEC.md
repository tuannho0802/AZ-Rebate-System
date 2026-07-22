# Đặc tả tính năng: Rebate Management

> File này mô tả đầy đủ logic nghiệp vụ, thiết kế dữ liệu, API, và UI cho tính năng
> "Rebate Management" mới trong Admin Console. Agent thực hiện task này phải đọc
> file này và `DESIGN_FORMAT.md` (chuẩn UI chung của hệ thống) trước khi code.
>
> **Lưu ý quan trọng:** Đây là task lớn, chia làm nhiều bước có checkpoint. KHÔNG code
> liền một mạch từ đầu đến cuối rồi mới báo cáo — phải dừng lại báo cáo sau mỗi giai
> đoạn lớn (xem mục "Thứ tự thực hiện & Checkpoint" ở cuối file).

---

## 1. Bối cảnh & Mục tiêu

Hệ thống hiện có cơ chế phân cấp hoa hồng: mỗi User có `level` (0 = MIB gốc, 1 = Lv1,
2 = Lv2... tối đa Lv9), và mỗi cặp `User-Asset` có 1 `UserCommissionConfig` lưu
`rebateUnit` (rebate) và `markupPips` (markup) mà user đó được giữ lại riêng ở cấp
của mình.

**Vấn đề cần giải quyết:** Admin cần 1 công cụ để:
1. Thiết kế trước một bộ khung phân bổ rebate/markup chuẩn theo từng cấp (không gắn
   với user thật) → gọi là **Tab "Cấu hình mẫu"**.
2. Xem và chỉnh sửa trực tiếp rebate/markup thật của bất kỳ nhánh MIB nào đang tồn
   tại trong hệ thống, đảm bảo tổng phân bổ luôn khớp đúng giới hạn tối đa cho phép
   → gọi là **Tab "Xem theo nhánh thật"**.

Tính năng này nằm ở mục sidebar mới **"Rebate Management"**, dưới `admin`, tương tự
vị trí `Commission Configs`, `Payout Sessions`.

---

## 2. Khái niệm cốt lõi

### 2.1. Cap Max (giới hạn tối đa) — thuộc về Asset

Mỗi Asset có 3 giới hạn tối đa:
- `capMaxRebate`: tổng Rebate tối đa được phép phân bổ qua toàn bộ các cấp (MIB→Lv9)
  cho asset này.
- `capMaxMarkup`: tổng Markup tối đa được phép phân bổ qua toàn bộ các cấp.
- `capMaxTotal`: tổng (Rebate + Markup) tối đa — có thể nhỏ hơn `capMaxRebate + capMaxMarkup`
  cộng lại (là 1 giới hạn độc lập, không phải phép tính suy ra từ 2 cái trên).

Các trường này **nullable** ở DB. Nếu asset chưa có Cap Max, Admin **không được phép**
chỉnh sửa Rebate Management cho asset đó (xem mục 5.3).

### 2.2. Own vs Cumulative — 2 số hiển thị trên mỗi ô/node

Mỗi node (= 1 user ở 1 cấp, trong ngữ cảnh 1 Asset cụ thể) có 2 giá trị:

- **`own` (số chính, hiển thị đậm, phía trên):** Rebate/Markup mà **chính user đó**
  giữ lại riêng, không tính con cháu. Đây chính là `rebateUnit`/`markupPips` trong
  `UserCommissionConfig`.
- **`cumulative` (số phụ, hiển thị nhỏ, phía dưới):** Tổng Rebate/Markup **cộng dồn
  từ node đó xuống hết nhánh con phía dưới nó** (own của chính nó + own của tất cả
  con cháu trên cùng 1 đường đi).

**Ví dụ minh hoạ (1 nhánh thẳng, không rẽ):**
```
MIB   (own=2) → cumulative = 2+2+2+2+2 = 10
Lv1   (own=2) → cumulative = 2+2+2+2   = 8
Lv2   (own=2) → cumulative = 2+2+2     = 6
Lv3   (own=2) → cumulative = 2+2       = 4
Lv4   (own=2) → cumulative = 2         = 2
```
Số chính hiển thị: `2 - 2 - 2 - 2 - 2`. Số phụ hiển thị: `10 - 8 - 6 - 4 - 2`.

### 2.3. QUY TẮC BẮT BUỘC: cumulative khi 1 node có nhiều nhánh con (per-path)

**Đây là điểm dễ làm sai nhất — đọc kỹ.**

Cây user thật có thể rẽ nhiều nhánh song song ở cùng 1 cấp (ví dụ 1 MIB có 3 IB con
ở Lv1: `Lv1-A`, `Lv1-B`, `Lv1-C`). Khi đó:

- **SAI:** `cumulative(node cha) = own(cha) + tổng cumulative của TẤT CẢ children`
  → Đây là lỗi cộng dồn nhầm nhiều nhánh độc lập vào 1 con số, gây sai lệch validate
  Cap Max (false positive "vượt cap" dù từng nhánh riêng vẫn đúng).

- **ĐÚNG (Phương án X — per-path):**
  - Nếu 1 node có **nhiều hơn 1 con** (rẽ nhánh): node đó **không có 1 giá trị
    cumulative duy nhất** vì giá trị này phụ thuộc vào việc đi theo nhánh nào.
    → `cumulativeRebate = null`, `cumulativeTotal = null` tại chính node cha đó.
  - Cumulative chỉ được tính và hiển thị **bắt đầu từ node con trở xuống**, mỗi
    nhánh con tự có `cumulative` riêng của nó, hoàn toàn độc lập với nhánh anh em.
  - Công thức đệ quy (tính từ leaf ngược lên): với 1 node có đúng 1 con hoặc là leaf:
    `cumulative(node) = own(node) + cumulative(con của nó)`; nếu là leaf (không có
    con): `cumulative(node) = own(node)`.

**Ví dụ minh hoạ (có rẽ nhánh):**
```
MIB (own=2, cumulative=null)          ← rẽ 2 nhánh, không có 1 số cumulative chung
├─ Lv1-A (own=2, cumulative=8)        ← 2 + 6 (từ Lv2-A1)
│   └─ Lv2-A1 (own=2, cumulative=6)   ← 2 + 4 (từ Lv3-A1a)
│       └─ ... (own=2, cumulative=4)
│           └─ ... (own=2, cumulative=2)
└─ Lv1-B (own=2, cumulative=6)        ← 2 + 4 (từ Lv2-B1)
    └─ Lv2-B1 (own=2, cumulative=4)   ← 2 + 2 (từ Lv3-B1)
        └─ ... (own=2, cumulative=2)
```

### 2.4. Validate Cap Max — theo từng path riêng

Vì mỗi nhánh (path từ root đến 1 leaf) là 1 đường đi độc lập, validate Cap Max
**phải làm theo từng path riêng biệt**, không phải theo tổng toàn bộ subtree của
node cha. Khi Admin sửa 1 giá trị `own` ở 1 node bất kỳ, hệ thống phải:
1. Xác định tất cả các path đi qua node đó (từ root xuống đến từng leaf).
2. Với mỗi path, tính lại tổng Rebate/Markup/Total của toàn path.
3. So sánh với `capMaxRebate`/`capMaxMarkup`/`capMaxTotal` của Asset.
4. Nếu **bất kỳ path nào** vượt hoặc chưa đủ (không khớp chính xác) → từ chối lưu,
   trả lỗi rõ ràng path nào, lệch bao nhiêu.

**Quy tắc "đủ, không thừa không thiếu":** tổng Rebate của 1 path phải bằng chính xác
`capMaxRebate` (không chỉ là `<=`). Tương tự cho Markup và Total.

---

## 3. Thiết kế dữ liệu (Database)

### 3.1. Mở rộng bảng `Asset`
Thêm 3 cột nullable:
```prisma
model Asset {
  // ...existing fields...
  capMaxRebate Decimal? @db.Decimal(12, 4)
  capMaxTotal  Decimal? @db.Decimal(12, 4)
  capMaxMarkup Decimal? @db.Decimal(12, 4)
  // ...existing relations...
}
```

### 3.2. Bảng mới `TemplateLevelConfig` (cho Tab "Cấu hình mẫu")
```prisma
model TemplateLevelConfig {
  id         String   @id @default(uuid())
  templateId String
  level      Int      // 0=MIB, 1=Lv1, ..., 9=Lv9
  assetId    String
  rebateUnit Decimal  @db.Decimal(12, 4)
  markupPips Decimal  @db.Decimal(12, 4)

  template Template @relation(fields: [templateId], references: [id], onDelete: Cascade)
  asset    Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([templateId, level, assetId])
  @@index([templateId, level])
}
```
Nhớ thêm quan hệ ngược `levelConfigs TemplateLevelConfig[]` vào `Template`, và
`rebateConfigs TemplateLevelConfig[]` vào `Asset` (Prisma yêu cầu quan hệ 2 chiều).

**Validate khi lưu 1 `TemplateLevelConfig`:**
- `rebateUnit <= capMaxRebate` của asset (nếu asset chưa có Cap Max → chặn, xem 5.3).
- `markupPips <= capMaxMarkup`.
- `rebateUnit + markupPips <= capMaxTotal`.
- (Lưu ý: ở cấp độ 1 config riêng lẻ chỉ cần `<=`; ràng buộc "đủ chính xác = Cap Max"
  áp dụng khi **tổng tất cả level của cùng 1 template cho cùng 1 asset** được cộng
  lại — xem 3.3.)

### 3.3. Đối chiếu tổng theo Template
Khi Admin lưu toàn bộ cấu hình cho 1 Asset trong 1 Template (tất cả các level từ
MIB đến Lv9 đã điền), tổng `rebateUnit` của mọi level phải bằng chính xác
`capMaxRebate` của asset đó. Tương tự cho `markupPips` và tổng cộng.

### 3.4. Dữ liệu thật (Tab "Xem theo nhánh") — không cần bảng mới
Dùng lại `UserCommissionConfig` hiện có (đã lưu theo User-Asset). Cấp (`level`) lấy
từ field `level` sẵn có trên `User`. Không cần thêm cột `depth` mới.

---

## 4. Thiết kế API

### 4.1. Tab "Cấu hình mẫu" (Template Level) — tái dùng cơ chế Template

- `POST /templates` — tạo template mới, thêm field `type: 'ITEM' | 'LEVEL'` để phân
  biệt template kiểu cũ (`TemplateItem`) và kiểu mới (`TemplateLevelConfig`).
- `POST /templates/:id/level-configs` — thêm/cập nhật 1 hoặc nhiều
  `TemplateLevelConfig` cho 1 template (theo asset + level).
- `applyTemplate()` (đã có sẵn) — sửa lại logic: nếu `template.type === 'LEVEL'`,
  áp dụng theo `TemplateLevelConfig` (map level → user tương ứng trong nhánh đích);
  nếu `type === 'ITEM'`, giữ nguyên hành vi cũ (`TemplateItem`). **Không được phá
  vỡ hành vi cũ của template kiểu ITEM đang chạy trong hệ thống.**

### 4.2. Tab "Xem theo nhánh thật" (Branch-based)

**`GET /rebate-management/overview`**
Trả về danh sách tất cả MIB gốc (`level = 0`, `parentId = null`) kèm trạng thái:
```json
[
  {
    "rootUserId": "...",
    "rootEmail": "...",
    "totalUsers": 15,
    "assetsChecked": 18,
    "status": "exceeded" | "missing" | "within",
    "assetsExceededCount": 2,
    "assetsMissingConfigCount": 3
  }
]
```
- `assetsChecked` = đếm động số Asset có `isActive = true`.
- `status`:
  - `exceeded` nếu có ít nhất 1 path trong nhánh vượt hoặc không khớp chính xác Cap Max.
  - `missing` nếu có asset nào đó thiếu config hoàn toàn ở 1 hoặc nhiều node trong nhánh.
  - `within` nếu mọi asset, mọi path đều khớp chính xác Cap Max.

**`GET /rebate-management/:rootUserId/asset/:assetId`**
Trả về cây đầy đủ dạng đệ quy cho 1 nhánh + 1 asset:
```json
{
  "asset": {
    "id": "...", "code": "...", "name": "...",
    "capMaxRebate": 100.0000, "capMaxMarkup": 50.0000, "capMaxTotal": 120.0000
  },
  "root": {
    "userId": "...", "email": "...", "level": 0,
    "rebate": 2.0000, "markup": 1.0000, "transferUnit": 3.0000,
    "cumulativeRebate": null,
    "cumulativeTotal": null,
    "children": [ /* đệ quy, xem quy tắc mục 2.3 */ ]
  }
}
```
Nếu asset chưa có Cap Max (`capMaxRebate/capMaxMarkup/capMaxTotal` đều null) → trả
lỗi `400` với message: *"Asset chưa có Cap Max. Vui lòng nhập Cap Max Rebate, Cap
Max Markup, Cap Max Total trước."*

**`PATCH /rebate-management/:rootUserId/asset/:assetId`**
Body:
```json
{ "updates": [ { "userId": "...", "rebate": 2.5, "markup": 1.0 } ] }
```
Backend validate theo **từng path** đi qua các `userId` bị sửa (xem mục 2.4). Nếu
có path nào lệch (thừa hoặc thiếu) so với Cap Max tương ứng → `400`, message nêu rõ
path nào (liệt kê chuỗi email từ root đến leaf) và lệch bao nhiêu.

---

## 5. UI (tuân thủ `DESIGN_FORMAT.md`)

### 5.1. Cấu trúc trang
`src/app/admin/rebate-management/page.tsx` — theo đúng `PageShell → PageBody → Card`,
không banner, không heading rời. Trong `Card` đầu tiên có 2 tab: **"Cấu hình mẫu"**
và **"Xem theo nhánh thật"**.

### 5.2. Tab "Cấu hình mẫu"
- Chọn 1 Template (hoặc tạo mới, chọn type = Level).
- Chọn 1 Asset để cấu hình.
- Hiển thị dạng bảng: cột = MIB, Lv1...Lv9; 1 hàng nhập `rebateUnit`, 1 hàng nhập
  `markupPips` (tương tự bố cục "Rebate (pips)" / "Markup Option" trong file Excel
  gốc mà người dùng đã tham chiếu ban đầu — cột theo cấp, không phải theo user thật).
- Hiển thị tổng cộng đang nhập / Cap Max cạnh nhau theo thời gian thực, cảnh báo màu
  đỏ nếu tổng chưa khớp chính xác Cap Max (thừa hoặc thiếu).
- Nút "Lưu cấu hình mẫu" chỉ bật khi tổng khớp chính xác Cap Max.

### 5.3. Tab "Xem theo nhánh thật"
- Đầu tab: bảng tổng quan (dùng API `overview`) — liệt kê tất cả MIB gốc, cột trạng
  thái dùng `Badge` (xanh = within, vàng = missing, đỏ = exceeded), bấm vào 1 dòng
  để mở chi tiết nhánh đó.
- Chi tiết nhánh: chọn 1 Asset (dropdown), hiển thị cây (tree, có thể thu gọn/mở
  rộng từng node) — **không phải bảng cột cố định** vì số nhánh con không cố định.
- Mỗi node trong cây hiển thị: tên/email user, badge cấp (MIB/Lv1...), 2 số (own
  đậm ở trên, cumulative nhỏ ở dưới — nếu `cumulative = null` do node có nhiều
  nhánh con thì không hiển thị số phụ, chỉ hiển thị số chính).
- Sửa trực tiếp tại chỗ (inline edit) trên `own`, có nút Lưu riêng từng node hoặc
  Lưu hàng loạt.
- Nếu asset chưa có Cap Max: hiện banner cảnh báo ngay đầu, kèm form nhập nhanh Cap
  Max (chặn thao tác sửa cho đến khi nhập xong).

### 5.4. Phân biệt Template Item / Template Level ở trang Templates hiện có
- Thêm 1 tag hiển thị loại: `Template Item` (cũ) hoặc `Template Level` (mới) trên
  mỗi dòng template.
- Cột "Items" hiển thị tương ứng: `N item` (cũ) hoặc `N level × N asset` (mới).
- Khi tạo template mới: có lựa chọn chọn loại trước (2 nút/radio: "Template Item"
  / "Template Level"), dẫn tới 2 form khác nhau.

### 5.5. Xuất Excel
Nút "Xuất Excel" ở Tab "Cấu hình mẫu" (xuất theo 1 template đã chọn) và/hoặc ở Tab
"Xem theo nhánh thật" (xuất theo 1 nhánh + asset đã chọn). Cấu trúc file xuất:
- Cột: `MIB | Lv1 | Lv2 | ... | Lv9` (không xuất theo email user thật ở Tab Cấu hình
  mẫu; nếu xuất từ Tab Nhánh thật thì mỗi cột vẫn theo cấp nhưng ghi rõ email user
  tương ứng của path đang xem).
- Hàng: từng Asset.
- 2 block xếp dọc trong cùng sheet: "Rebate" và "Markup Option".
- Mỗi ô: dòng trên = số chính (own), dòng dưới = số phụ (cumulative) — dùng
  merge cell hoặc line break trong cell tuỳ khả năng thư viện.
- Cột cuối mỗi hàng: `Cap Max Rebate`, `Cap Max Total` (block Rebate),
  `Cap Max Markup` (block Markup).
- Dùng thư viện `exceljs` (kiểm tra đã có trong `package.json` chưa, nếu chưa thêm
  mới).

---

## 6. Ràng buộc chung (áp dụng toàn bộ tính năng)

- Không đụng vào AuthContext, `logout()`, routing/guard.
- Không sửa cấu trúc UI đã có của `Commission Configs` và `Payout Sessions` — đây là
  bản mẫu chuẩn, chỉ được tham chiếu, không được chỉnh sửa.
- `applyTemplate()`/`lockTemplate()` hiện tại phải tiếp tục hoạt động đúng 100% với
  template kiểu cũ (`ITEM`) sau khi thêm kiểu mới (`LEVEL`) — bắt buộc test regression.
- Toàn bộ UI mới phải dùng component chuẩn (`Card`, `Table`, `Th`, `Td`, `Badge`,
  `Button`, `Field`, `Input`) từ `components/ui/primitives`, không tự style rời.

---

## 7. Thứ tự thực hiện & Checkpoint (bắt buộc dừng lại báo cáo)

**Checkpoint 1 — Backend nền tảng (dừng lại, báo cáo, chờ duyệt):**
1. Migration: `Asset` (3 cột Cap Max) + `TemplateLevelConfig`.
2. API Tab "Cấu hình mẫu": tạo/sửa `TemplateLevelConfig`, sửa `applyTemplate()` để
   hỗ trợ cả 2 loại template.
3. API Tab "Xem theo nhánh thật": `overview`, `GET .../asset/:assetId` (cây per-path
   đúng theo mục 2.3), `PATCH .../asset/:assetId` (validate per-path đúng mục 2.4).

Báo cáo tại checkpoint này cần có:
- Xác nhận migration chạy thành công, không phá dữ liệu cũ.
- Response thật (không phải ví dụ) của API `GET .../asset/:assetId` cho 1 nhánh có
  rẽ nhánh — xác nhận đúng node rẽ nhánh có `cumulativeRebate: null`.
- Thử `PATCH` với 1 case hợp lệ và 1 case cố tình lệch Cap Max — xác nhận lỗi 400
  trả về đúng message, đúng path.
- Test regression: `applyTemplate()` với 1 template kiểu cũ (ITEM) vẫn hoạt động
  đúng như trước khi thêm tính năng mới.
- `npm run build` sạch ở backend.

**Checkpoint 2 — Frontend (chỉ bắt đầu sau khi Checkpoint 1 được duyệt):**
4. UI Tab "Cấu hình mẫu".
5. UI Tab "Xem theo nhánh thật" (cây, inline edit).
6. Validate Cap Max ở FE (đồng bộ với BE, không chỉ dựa vào BE).
7. Chức năng xuất Excel.

Báo cáo tại checkpoint này cần có: ảnh chụp cả 2 tab, 1 ví dụ thực tế thử vượt Cap
Max để xem cảnh báo hiển thị ra sao trên UI, file `.xlsx` xuất thử, log build sạch
toàn bộ (`npm run build` ở cả frontend và backend).

**Không được gộp 2 checkpoint làm 1 lần báo cáo duy nhất.**