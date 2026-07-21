# Prompt cho Agent — Tái thiết UX Frontend Rebate System

Dán nguyên văn phần dưới đây cho agent (Claude Code hoặc tương đương, có quyền
đọc/sửa toàn bộ repo). Agent phải làm theo đúng thứ tự phase, KHÔNG được nhảy
cóc, và phải dừng lại báo cáo nếu phát hiện phase nào cần thay đổi backend.

---

## 0. Đọc trước khi làm gì khác

Trước khi sửa bất kỳ dòng code nào, đọc theo thứ tự:
1. `API_REFERENCE.md` — path/body/response thật của từng route.
2. `BUSINESS_RULES.md` — logic nghiệp vụ đã chốt (cap/orphan/version/lock...).
3. `FRONTEND_CONVENTIONS.md` — cấu trúc code FE, quy ước gọi API hiện có.
4. `FRONTEND_BUILD_PLAN.md` — trạng thái từng Flow.
5. Toàn bộ `src/components/`, `src/app/`, `src/lib/api/` hiện tại — đừng đoán
   shape dữ liệu, đọc code thật (đặc biệt `CommissionManager.tsx`,
   `lib/api/user.ts`, `lib/api/template.ts`, `lib/api/payout-session.ts`).

**Nguyên tắc bất biến trong toàn bộ prompt này:**
- KHÔNG đổi business logic, permission, guard nào ở backend hay frontend trừ
  khi mục cụ thể bên dưới yêu cầu (và mục đó sẽ ghi rõ "cần backend").
- KHÔNG đổi shape response API hiện có trừ khi được yêu cầu rõ ràng.
- Sau MỖI phase: chạy `npm run build` (0 type error) VÀ
  `node test/test-flow-check.js` (không được có FAIL mới so với baseline
  89/89 PASS) trước khi sang phase kế tiếp. Nếu build hoặc test fail, dừng
  lại và sửa trước khi tiếp tục — không được để lỗi dồn sang phase sau.
- Với bất kỳ chỗ nào cần dữ liệu chưa chắc chắn có trong response thật (ví
  dụ field `level` trên `User`, shape `subtree`), phải gọi thử API thật hoặc
  đọc code backend service để xác nhận trước khi code, không giả định.

---

## 1. Mục tiêu tổng thể

Người dùng cuối (Admin, MIB, IB) hiện phải:
- Tự gõ tay UUID vào input text (parentId, sourceUserId, assetId, targetUserId).
- Nhìn thấy UUID thô rải rác khắp UI.
- Cuộn qua danh sách Template dài vô tận, mỗi template expand full 18 dòng
  asset cùng lúc.
- Suy ra "cấp" (level) của Template qua tên gọi (`Standard Template L2`) vì
  không có cách hiển thị nào khác.
- Không có cách nào xem quan hệ cha-con dạng cây (tree) trực quan.
- Không có UI cho Lock/Unlock Template dù API đã có sẵn.
- Trang Admin > Users/Assets chỉ là card trung gian bắt bấm thêm 1 lần mới
  vào được bảng thật.

Mục tiêu: loại bỏ toàn bộ những điều trên, tối ưu cho người dùng cuối
không rành kỹ thuật, có thể test tay dễ dàng.

---

## 2. Phase 1 — Component nền tảng (làm trước, dùng lại ở mọi phase sau)

### 2.1 `SearchableSelect` (combobox tìm-kiếm-và-chọn)
Tạo 1 component dùng chung, thay thế MỌI input text nhập ID thủ công trong
toàn bộ codebase. Yêu cầu:
- Props tối thiểu: `options: { id: string; label: string; sublabel?: string;
  disabled?: boolean; tag?: string }[]`, `value`, `onChange`, `placeholder`,
  `loading?`, `emptyMessage?`.
- Gõ để lọc theo `label`/`sublabel` (client-side filter, không cần debounce
  gọi API trừ khi danh sách quá lớn — xem 2.2).
- Hiển thị `label` (tên/email người dùng, hoặc mã+tên asset) — KHÔNG BAO GIỜ
  hiển thị `id` trong UI, kể cả rút gọn. `id` chỉ tồn tại trong `value`/
  `onChange` phía dưới.
- Có thể hiện `tag` nhỏ bên phải mỗi option (ví dụ role MIB/IB, hoặc level).
- Bàn phím: mũi tên lên/xuống + Enter để chọn, Esc để đóng.

### 2.2 Danh sách lớn (nếu số user/asset có thể vượt 100)
Nếu xác nhận được (đọc code backend / hỏi lại nếu không chắc) rằng số user
hoặc asset trong hệ thống có thể vượt quá 1 trang API, `SearchableSelect`
phải hỗ trợ gọi API tìm kiếm theo từ khoá (debounce ~300ms) thay vì tải hết
về client. Nếu backend chưa có endpoint search, dùng tạm client-side filter
trên danh sách đã tải nhưng GHI RÕ comment `// TODO: cần endpoint search
phía backend khi số lượng user/asset lớn` để không bị quên.

### 2.3 `IdDisplay` / quy tắc ẩn ID toàn cục
Thêm 1 helper hiển thị: khi có `userId`/`assetId` cần hiện cho người dùng,
LUÔN resolve qua danh sách user/asset đã tải (map theo id → email/fullName
hoặc code/name) và hiện tên đó. Nếu không resolve được (chưa tải xong, hoặc
không tìm thấy), hiện fallback rõ ràng như `"Không xác định"` — KHÔNG hiện
UUID thô, kể cả rút gọn dạng `12345678…`. ID gốc chỉ được phép nằm trong
`title` attribute (tooltip khi hover) cho mục đích debug, không phải trong
text hiển thị chính.

Áp dụng ngay component/2 helper này vào toàn bộ các chỗ đang vi phạm dưới đây.

---

## 3. Phase 2 — Xoá bỏ input ID thủ công (áp dụng SearchableSelect)

Rà toàn bộ codebase tìm mọi input nhận ID dạng text tự do (không chỉ các file
liệt kê — đây chỉ là các điểm đã biết chắc, có thể còn sót):

1. `UserFormDialog.tsx` — field "Parent ID" đang là `<Input>` text tự do →
   đổi thành `SearchableSelect` liệt kê user hiện có (label = email + tên,
   tag = role), chỉ hiện khi role = IB, lọc sẵn để không cho chọn chính nó
   nếu đang edit (trường hợp tạo mới thì không áp dụng).
2. `sessions/page.tsx` (Payout Sessions) — "Source User ID" và "Asset ID"
   đang là input text tự do → đổi thành `SearchableSelect`.
3. `ApplyTemplateDialog` trong `CommissionManager.tsx` và trang
   `admin/templates` — hiện đã dùng `<select>` HTML thuần, nâng cấp lên
   `SearchableSelect` để nhất quán và hỗ trợ tìm kiếm khi danh sách dài.
4. Bất kỳ chỗ nào khác có input nhận UUID — áp dụng cùng pattern.

Sau mỗi form sửa: xác nhận state gửi lên API vẫn đúng type/shape cũ (chỉ đổi
UI nhập liệu, không đổi payload gửi đi).

---

## 4. Phase 3 — Ẩn toàn bộ ID thô khỏi hiển thị

Rà và sửa các chỗ đã biết:
- `UserTable.tsx` — cột "Cha (parent)" đang hiện `parentId.slice(0,8)…` →
  đổi sang resolve tên/email cha qua danh sách user đã tải.
- Trang `mib/page.tsx` phần Subtree view — đang hiện
  `node.id.slice(0,8)…` → đổi sang tên/email qua `userById` map (đã có sẵn
  biến này trong code, chỉ cần đổi phần render).
- `sessions/page.tsx` — ledger entries đang hiện `entry.beneficiaryId` thô,
  và session detail hiện `sourceUserId`/`assetId` thô → resolve qua danh
  sách user/asset đã tải trong trang.
- Bất kỳ `.id` nào khác đang render trực tiếp ra text trong JSX — audit toàn
  bộ bằng cách grep `\.id\b` trong các file `.tsx` và xem từng kết quả.

---

## 5. Phase 4 — Template UX

### 5.1 Tách "tên hiển thị" khỏi "level"
- Thêm 1 component `LevelBadge` nhỏ, nhận `level: number`, tự render thành
  tag kiểu "Cấp 1", "Cấp 2"... KHÔNG dựa vào text trong `template.name`.
- Ở mọi nơi hiện tên template (dropdown, card, table), hiện `template.name`
  NGUYÊN VĂN + `<LevelBadge level={template.level} />` cạnh bên — không tự
  chèn chữ "L1/L2" vào chuỗi tên.
- Đây là thay đổi UI, nhưng **dữ liệu hiện tại trong DB đã có tên kiểu
  "Standard Template L3"** — agent KHÔNG tự động đổi tên các bản ghi hiện
  có (đó là quyết định nghiệp vụ của Admin, không phải việc của agent).
  Ghi rõ trong báo cáo cuối: "Cần Admin tự đổi tên các Template hiện có để
  bỏ hậu tố cấp khỏi tên, UI đã sẵn sàng hiển thị badge cấp riêng."

### 5.2 Danh sách Template thu gọn mặc định
- Trang `admin/templates` và mọi nơi liệt kê nhiều template: mỗi template
  hiện dưới dạng card/hàng THU GỌN mặc định — chỉ hiện: tên, `LevelBadge`,
  số lượng asset đã set (khác 0), nút "Xem chi tiết".
- Bấm vào mới expand ra bảng đầy đủ item (asset/rebate/markup) như hiện tại.
- Chỉ 1 template được mở rộng tại 1 thời điểm (accordion), hoặc cho phép
  nhiều nhưng phải có nút "Thu gọn tất cả" — chọn phương án nào dễ dùng hơn
  khi test tay với ~6-10 template.

### 5.3 Lọc Template theo cấp áp dụng (⚠️ CẦN KIỂM TRA BACKEND TRƯỚC)
Hiện tượng: dropdown chọn Template để áp cho user (ở `/mib` và
`admin/templates`) đang liệt kê TẤT CẢ template mọi cấp, không lọc theo cấp
của user đích. Vì test trước đó xác nhận field `level` bị ẩn khỏi response
non-admin, FE không đủ dữ liệu để tự lọc phía client cho MIB/IB.

Việc cần làm theo thứ tự:
1. Đọc lại endpoint `GET /templates/visible` ở backend — xác nhận nó có
   nhận được `targetUserId`/level nào không, và có filter theo cấp áp dụng
   được cho user đó không.
2. Nếu backend CHƯA filter theo cấp: đây là thay đổi backend, không phải
   FE thuần. Agent dừng lại, không tự ý sửa business logic — báo cáo lại
   cho người yêu cầu (kèm đề xuất cụ thể: ví dụ thêm query param
   `?forUserId=` cho `/templates/visible`, backend tự tính level phù hợp
   và chỉ trả về template khớp, không cần trả field `level` thô nếu vẫn
   muốn ẩn số cấp cụ thể khỏi non-admin).
3. Nếu backend ĐÃ có cơ chế filter nhưng FE chưa dùng đúng — chỉ cần sửa FE
   gọi đúng tham số.

### 5.4 UI Lock / Unlock Template (đang thiếu hoàn toàn)
API đã có sẵn (`lockTemplate`, `unlockTemplate`, `listVisibleTemplates` —
xem `lib/api/template.ts`), chỉ thiếu UI:
- Ở mỗi dòng/card Template trong danh sách mà MIB/IB xem áp dụng cho con
  trực tiếp, thêm nút Lock/Unlock (chỉ hiện với actor có quyền — cha trực
  tiếp của user đích, theo đúng rule đã biết: "Chỉ cha TRỰC TIẾP mới
  lock/unlock được").
- Hiện rõ trạng thái hiện tại (đã lock cho user X hay chưa) — cần gọi
  `listVisibleTemplates` hoặc endpoint tương ứng để biết trạng thái, xác
  nhận shape response trước khi code UI dựa vào nó.
- Bấm Lock/Unlock xong phải tự refresh lại trạng thái, không cần reload
  trang.

---

## 6. Phase 5 — Admin Users/Assets: bỏ card trung gian

`admin/page.tsx` hiện có tab Users/Assets chỉ render 1 Card mô tả + nút
"Mở Users →" dẫn sang route riêng. Đổi thành: nhúng thẳng
`UserTable`/`AssetTable` (component đã có sẵn) trực tiếp vào nội dung tab,
không cần điều hướng thêm. Route riêng `/admin/users`, `/admin/assets` vẫn
giữ nguyên (không xoá, có thể vẫn cần cho deep-link), chỉ đổi tab trong
`/admin` để không bắt người dùng bấm thêm 1 lần.

---

## 7. Phase 6 — Trực quan hoá quan hệ cha-con dạng cây

Trang `/mib` hiện chỉ có lưới card phẳng + subtree hiện dạng list thụt lề
bằng `padding-left`. Cải tiến:
- Giữ nguyên cách gọi API hiện có (`getSubtree`), chỉ đổi phần render.
- Dựng lại thành cây phân cấp thật (thu/phóng từng nhánh — accordion lồng
  nhau), mỗi node hiện: tên/email (KHÔNG hiện ID thô — xem Phase 3), role
  badge, active badge, và số con trực tiếp nếu có.
- Ưu tiên đơn giản, dễ test tay hơn là đẹp — không cần thư viện graph phức
  tạp, 1 component đệ quy React thuần là đủ.

---

## 8. Phase 7 — Đơn giản hoá luồng cấu hình Commission cho MIB/IB

`CommissionManager.tsx` hiện gộp quá nhiều chức năng trong 1 component lớn
(661 dòng): chọn asset, xem cap của mình, bảng con trực tiếp, 4 dialog con
(tạo TK, sửa TK, set config, áp template), mỗi dòng con có 3 nút hành động.
Yêu cầu:
- Tách nhỏ theo chức năng thành các component con trong 1 thư mục riêng
  (ví dụ `commission-manager/`), giữ nguyên hành vi và API call, chỉ tách
  file để dễ đọc/test/maintain — KHÔNG đổi logic.
- Xem lại có thể gộp "Sửa TK" + "Set Config" + "Nhiều Asset" thành 1 luồng
  rõ ràng hơn không (ví dụ: bấm vào 1 dòng user mở ra 1 panel/drawer duy
  nhất có đủ 3 tab, thay vì 3 nút rời rạc dễ nhầm) — đề xuất phương án cụ
  thể trước khi code nếu không chắc, đừng tự quyết định thay đổi lớn về
  luồng UX mà không có xác nhận.

---

## 9. Phase 8 — Route MIB/IB

Hiện `mib/page.tsx` phục vụ cả MIB lẫn IB (dựa vào `user.role` để chỉnh nội
dung, cần xác nhận lại bằng cách đọc code thật vì mô tả ban đầu chỉ nói
"MIB và IB chỉ có page.tsx cho 2 trang này trong 1 trang" — kiểm tra xem có
đúng là code IB hiện đang tái sử dụng y chang route `/mib` hay có route
`/ib` riêng nhưng nội dung giống hệt). Sau khi xác nhận:
- Nếu 2 role dùng chung logic 99% giống nhau: giữ 1 component dùng chung
  nhưng đặt tên trung lập (không gọi cứng là "Mib..."), route riêng biệt
  `/mib` và `/ib` vẫn giữ để phân quyền/điều hướng đúng, chỉ khác title.
- Nếu phát hiện có sự khác biệt về quyền/nội dung giữa MIB và IB mà code
  hiện tại đang xử lý sai hoặc thiếu — báo cáo, không tự sửa business logic.

---

## 10. Báo cáo cuối cùng

Sau khi hoàn tất tất cả phase (hoặc dừng ở phase cần xác nhận backend),
agent phải xuất báo cáo gồm:
1. Bảng từng phase: trạng thái (Done / Blocked — cần backend / Cần xác
   nhận thêm), file đã sửa.
2. Kết quả `npm run build` và `node test/test-flow-check.js` cuối cùng.
3. Danh sách việc KHÔNG tự làm vì ngoài phạm vi FE (đặc biệt mục 5.3 —
   lọc Template theo cấp, và bất kỳ phát hiện nào ở mục 9 về khác biệt
   MIB/IB).
4. Danh sách gợi ý dọn dữ liệu thủ công (đặc biệt: đổi tên Template bỏ
   hậu tố L1/L2/L3, xem mục 5.1).