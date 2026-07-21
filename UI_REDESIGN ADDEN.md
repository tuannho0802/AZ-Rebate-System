# Bổ sung cho UI_REDESIGN.md — dựa trên kết quả thực tế sau Phase 1-4

Đưa file này CÙNG với `UI_REDESIGN.md` gốc cho agent. Đây là điều chỉnh dựa
trên review UI thật (không phải chỉ đọc code) sau khi agent báo cáo hoàn
thành Phase 1→4. Agent phải:
1. Sửa lại 2 điểm trong Phase 4 bên dưới TRƯỚC KHI làm tiếp Phase 5.
2. Đọc kỹ bản Phase 5 và Phase 8 đã viết lại ở đây — nó THAY THẾ hoàn toàn
   mục 6 và mục 9 trong file gốc, không phải bổ sung thêm.

---

## A. Sửa lại Phase 4 — Template UX (đã làm nhưng thiếu)

### A.1 Sort / group Template theo Level (mục 5.2 cũ — bổ sung)
Danh sách Template hiện đang liệt kê phẳng theo thứ tự tạo, không phân
nhóm. Yêu cầu thực tế:
- Group toàn bộ template theo `level`, sort tăng dần.
- Mỗi nhóm có 1 header rõ ràng, ví dụ:
  ```
  Cấp 0 (MIB)
    - Admin High Template
    - TestFlow Template
  Cấp 1
    - Low Template
    - High Template
  Cấp 2
    ...
  ```
- Trong mỗi nhóm, các template vẫn giữ dạng card thu gọn/expand
  (accordion) như đã làm ở Phase 4 — chỉ thêm layer group bên ngoài, không
  đổi lại phần accordion đã hoạt động đúng.
- Áp dụng group-by-level này cho MỌI nơi liệt kê nhiều template: trang
  `admin/templates`, dropdown chọn Template để áp dụng, dropdown trong
  dialog Lock/Unlock.

### A.2 Lock/Unlock — thêm bảng trạng thái, cho thao tác nhiều template
Dialog hiện tại (1 dropdown Template + 1 dropdown Con trực tiếp + nút
Khóa/Mở khóa) chỉ xử lý được **1 cặp (template, con) mỗi lần bấm**, và
không cho thấy đang khóa những gì — người dùng phải nhớ hoặc đoán. Sửa lại
luồng:
1. Đổi thứ tự chọn: chọn **Con trực tiếp** trước (1 `SearchableSelect`).
2. Sau khi chọn con, hiển thị ngay 1 **bảng danh sách toàn bộ Template**
   (group theo Level như mục A.1), mỗi dòng có:
   - Tên Template + `LevelBadge`.
   - Trạng thái hiện tại: `Đang khóa` / `Đang mở` (gọi
     `listVisibleTemplates` hoặc endpoint tương ứng để biết — nếu chưa xác
     nhận được shape response, đọc code backend trước khi giả định).
   - 1 nút toggle Khóa/Mở khóa NGAY TRÊN DÒNG ĐÓ (không cần dropdown Template
     riêng nữa).
3. Cho phép khóa/mở khóa nhiều dòng liên tiếp trong cùng 1 lần mở dialog,
   mỗi lần bấm chỉ gọi API cho đúng 1 dòng đó, tự cập nhật lại trạng thái
   dòng đó ngay (không cần đóng dialog / reload).
4. Giữ nguyên rule cũ: dialog chỉ hiện cho actor là cha trực tiếp của con
   đang chọn.

---

## B. Làm rõ lại Phase 5 — Admin Users/Assets (SỬA LẠI, thay thế mục 6 gốc)

Yêu cầu gốc "bỏ card trung gian" cần làm rõ để không bị hiểu nhầm thành chỉ
đổi chữ trên nút:
- Khi bấm vào tab (Users / Assets / Templates / Integrity Check / Commission
  Configs / Payout Sessions) trong `admin/page.tsx`, nội dung đầy đủ của
  mục đó phải **render ngay lập tức bên dưới tab**, không có bất kỳ nút
  "Mở XXX →" hay bước điều hướng trung gian nào nữa.
- Cụ thể: bỏ hẳn nút "Mở Users →", "Mở Assets →" khỏi `admin/page.tsx`.
  Thay bằng nhúng thẳng `UserTable` (kèm form filter + nút tạo user),
  `AssetTable`, `TemplateTable` (đã có từ Phase 4), v.v. trực tiếp vào
  `<Card>` tương ứng với từng tab.
- Route riêng (`/admin/users`, `/admin/assets`, `/admin/templates`) vẫn giữ
  nguyên để deep-link, KHÔNG xoá — chỉ là `/admin` không còn bắt bấm thêm để
  vào được nội dung.
- Áp dụng đúng pattern này cho TẤT CẢ 6 tab, không chỉ Users/Assets.

---

## C. Viết lại Phase 8 — Cấu trúc trang MIB/IB (SỬA LẠI, thay thế mục 9 gốc)

**Không copy lại pattern cũ của Admin (bấm mới hiện) sang cho MIB/IB** — mục
tiêu là dùng đúng pattern ĐÃ SỬA ở phần B (chọn tab → hiện ngay).

Hiện `mib/page.tsx` là 1 trang duy nhất nhồi tất cả: asset selector, subtree
view, toàn bộ `CommissionManager` (chọn con, set config, tạo TK, áp
template, lock/unlock...). Yêu cầu:

1. Thêm 1 thanh tab ngay trong trang MIB/IB (component dùng chung, không
   tạo route riêng trừ khi cần deep-link), ví dụ:
   - Tab "Cây con cháu" — chỉ phần Subtree view.
   - Tab "Con trực tiếp & Cấu hình" — bảng con trực tiếp + set config + tạo
     TK + sửa TK (phần lõi của `CommissionManager` sau khi đã tách nhỏ ở
     Phase 7).
   - Tab "Áp dụng Template" — riêng phần áp dụng.
   - Tab "Khóa / Mở khóa Template" — dùng dialog đã sửa ở mục A.2, có thể
     hiện luôn dạng trang thay vì dialog nếu hợp lý hơn khi đứng 1 mình.
   - Tab "Asset List" (view-only) — giữ như hiện tại.
2. Mỗi tab chọn là hiện nội dung ngay, không điều hướng, không nút "Mở...".
3. Route `/mib` và `/ib` vẫn tách biệt như hiện tại (khác quyền), nhưng dùng
   chung 1 component tab layout để nhất quán với Admin.
4. Việc này nên làm SAU Phase 7 (tách nhỏ `CommissionManager.tsx`) vì tab
   "Con trực tiếp & Cấu hình" cần các component con đã tách sẵn — nếu thấy
   hợp lý hơn, agent có thể gộp thứ tự Phase 7 và Phase 8 lại làm cùng lúc,
   miễn là báo rõ trong báo cáo.

---

## D. Ghi chú thêm (không bắt buộc, nhưng nên báo cáo)

- Danh sách Template hiện lẫn nhiều bản ghi trông như dữ liệu test tự sinh
  (tên dạng `TestFlow Template <timestamp>`, `Admin High Template
  <timestamp>` lặp lại nhiều lần) — nhiều khả năng do chạy
  `test/test-flow-check.js` nhiều lần mà không dọn dữ liệu sau test. Agent
  KHÔNG tự xoá các bản ghi này (có thể ảnh hưởng dữ liệu thật). Chỉ cần ghi
  chú lại trong báo cáo cuối, gợi ý người dùng tự dọn hoặc thêm bước cleanup
  vào script test.