# Prompt cho Agent — Tái thiết UX Frontend Rebate System (bản hợp nhất — thay thế toàn bộ `UI_REDESIGN.md` + `UI_REDESIGN_ADDENDUM.md` cũ)

Dán nguyên văn phần dưới đây cho agent. File này là bản HỢP NHẤT, thay thế
hoàn toàn `UI_REDESIGN.md` gốc và `UI_REDESIGN_ADDENDUM.md` — không cần
đưa 2 file cũ đó nữa. Phase 1-4 đã hoàn thành và xác nhận đúng (xem tóm
tắt mục 2), agent bắt đầu làm tiếp từ **Phase 5**.

---

## 0. Nguyên tắc bất biến (giữ nguyên xuyên suốt, không đổi)

- KHÔNG đổi business logic, permission, guard nào ở backend hay frontend
  trừ khi mục cụ thể yêu cầu rõ ràng.
- KHÔNG đổi shape response API hiện có trừ khi được yêu cầu rõ ràng.
- Sau MỖI phase: chạy `npm run build` (0 type error) VÀ
  `node test/test-flow-check.js` (không được có FAIL mới so với baseline
  hiện tại — xem số PASS chính xác ở mục 2) trước khi sang phase kế tiếp.
  Nếu build hoặc test fail, dừng lại sửa trước khi tiếp tục.
- Với bất kỳ chỗ nào cần dữ liệu chưa chắc chắn có trong response thật,
  phải đọc code backend service để xác nhận trước khi code, không giả
  định.
- Toàn bộ giao tiếp/báo cáo bằng tiếng Việt.

---

## 1. Mục tiêu tổng thể

Người dùng cuối (Admin, MIB, IB) không rành kỹ thuật phải thao tác được
dễ dàng: không gõ tay UUID, không thấy ID thô, danh sách Template có tổ
chức rõ ràng theo cấp, có UI Lock/Unlock kiểm soát thật (không chỉ ẩn
UI), và cấu trúc điều hướng nhất quán, dễ mở rộng giữa 3 role.

---

## 2. Đã hoàn thành (Phase 1-4) — KHÔNG làm lại, chỉ tham chiếu

### Phase 1 — Component nền tảng
- `SearchableSelect` (combobox tìm-kiếm-chọn, không hiện ID thô) — đã có,
  dùng chung toàn bộ codebase.
- `IdDisplay`/helper ẩn ID toàn cục — đã áp dụng.

### Phase 2-3 — Xoá input ID thủ công + ẩn ID thô khỏi hiển thị
- Toàn bộ form (`UserFormDialog`, `sessions/page.tsx`, `ApplyTemplateDialog`)
  dùng `SearchableSelect`. Không còn ID thô hiển thị ở `UserTable`,
  `mib/page.tsx`, `sessions/page.tsx`.

### Phase 4 — Template UX (đã audit + fix nhiều vòng, TRẠNG THÁI CUỐI CÙNG)
- `LevelBadge` hiển thị cấp độc lập với tên template.
- Danh sách Template group theo Level, accordion thu gọn/mở rộng.
- **Lock/Unlock — luồng đã chốt và xác nhận đúng:**
  - MIB/IB: dialog `ManageTemplateLockDialog` — chọn Con trực tiếp trước
    → bảng toàn bộ template CÙNG LEVEL với con đó, kèm trạng thái + toggle
    từng dòng.
  - Admin: khối UI trong `admin/templates/page.tsx` — chọn User bất kỳ
    cấp nào (kể cả MIB root) → bảng tương tự.
  - **Backend đã enforce lock THẬT ở tầng ghi dữ liệu**
    (`template-apply.service.ts`, hàm `applyTemplate()`) — không chỉ ẩn
    khỏi dropdown. Cố áp 1 template đang khóa cho đúng target sẽ bị chặn
    403, kể cả khi actor là Admin tự khóa rồi tự áp. Đã có test case xác
    nhận (`test-flow-check.js`, section 7).
- **Apply Template (Hướng 2 — đã chốt):** dialog `ApplyTemplateDialog`
  đổi thứ tự chọn Con trực tiếp TRƯỚC, sau đó gọi
  `getTemplateLockStatus(userId)` (route `GET /templates/locks/:userId`),
  lọc `isLocked === false` để nạp dropdown Template — không dùng
  `listVisibleTemplates()` cho mục đích này nữa (hàm đó chỉ phục vụ đúng
  1 việc: actor tự xem trạng thái visible của CHÍNH MÌNH, dùng
  `self.level`, KHÔNG được sửa lại công thức này nữa — đã từng đổi nhầm
  và gây regression, đã revert và chốt vĩnh viễn).

**Baseline test hiện tại: `test-flow-check.js` phải cho đúng 96/96 PASS.**
Nếu chạy ra số khác, DỪNG LẠI, báo cáo ngay, không tự sửa tiếp các phase
dưới đây cho tới khi baseline này được xác nhận lại đúng.

---

## 3. Phase 5 — Hệ thống Sidebar Layout dùng chung (làm TRƯỚC, nền tảng cho mọi phase sau)

### 3.1 Thiết kế chung

Bỏ hoàn toàn kiểu điều hướng "tab ảo trong 1 trang" (nút bấm đổi state,
URL không đổi) đang dùng ở `admin/page.tsx`. Thay bằng **Sidebar dọc bên
trái + khu vực nội dung bên phải render theo route thật** — áp dụng
thống nhất cho **cả 3 role**: Admin, MIB, IB.

Tạo 1 component dùng chung `RoleSidebarLayout` (đặt tại
`src/components/layout/RoleSidebarLayout.tsx`), props:
```ts
{
  basePath: string;        // '/admin' | '/mib' | '/ib'
  roleLabel: string;        // 'Admin' | 'MIB' | 'IB'
  items: {
    href: string;            // path đầy đủ, ví dụ `${basePath}/users`
    label: string;
    icon?: ReactNode;         // optional, dùng lucide-react nếu có
  }[];
}
```
Hành vi:
- Sidebar cố định bên trái (width ~240px), danh sách `items` render dạng
  link dọc, mục đang active (so khớp `usePathname()`) có highlight rõ
  ràng (nền khác màu/border trái).
- Bên phải là `{children}` — nội dung route con render đầy đủ ngay khi
  click, không có bước "Mở XXX →" trung gian nào.
- Header trên cùng sidebar hiện `roleLabel` + tên/email user đang đăng
  nhập (lấy từ `useAuth()`).
- Responsive: ở màn hình hẹp, sidebar có thể thu gọn thành icon-only hoặc
  drawer ẩn/hiện — làm ở mức đơn giản nhất đủ dùng, không cần phức tạp,
  ưu tiên đúng chức năng trước.

### 3.2 Áp dụng cho Admin

`app/admin/layout.tsx` dùng `RoleSidebarLayout` với:
```
items = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/assets', label: 'Assets' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/commission-configs', label: 'Commission Configs' },
  { href: '/admin/payout-sessions', label: 'Payout Sessions' },
  { href: '/admin/integrity-check', label: 'Integrity Check' },
]
```
Nội dung từng route (`UserTable`, `AssetTable`, `TemplateTable` +khối
Lock/Unlock đã có, v.v.) **giữ nguyên logic hiện có**, chỉ di chuyển vào
đúng route con nếu trước đây đang nhúng chung trong `admin/page.tsx`
dạng tab. Nếu route con (`/admin/users`, `/admin/assets`,
`/admin/templates`) đã tồn tại sẵn từ trước — chỉ cần đảm bảo chúng nằm
trong `layout.tsx` mới này, không cần viết lại nội dung bên trong.
`admin/page.tsx` (route gốc `/admin`) đổi thành dashboard tóm tắt ngắn
hoặc redirect sang `/admin/users` — chọn phương án nào hợp lý hơn khi
code.

**Cần tạo thêm** (nếu chưa có route riêng): `/admin/commission-configs`,
`/admin/payout-sessions`, `/admin/integrity-check` — nội dung lấy từ đúng
phần tương ứng đang có trong `admin/page.tsx` cũ (di chuyển, không viết
lại logic).

### 3.3 Áp dụng cho MIB/IB — SAU khi Phase 6, Phase 7 xong (xem mục 5, 6)

`app/mib/layout.tsx` và `app/ib/layout.tsx` dùng CHUNG `RoleSidebarLayout`,
chỉ khác `basePath`:
```
items = [
  { href: `${basePath}/tree`, label: 'Cây con cháu' },
  { href: `${basePath}/config`, label: 'Con trực tiếp & Cấu hình' },
  { href: `${basePath}/templates`, label: 'Áp dụng Template' },
  { href: `${basePath}/locks`, label: 'Khóa / Mở khóa Template' },
  { href: `${basePath}/assets`, label: 'Asset List' },
]
```
Chi tiết từng route xem mục 6.

---

## 4. Phase 6 — Trực quan hoá quan hệ cha-con dạng cây

Route: `${basePath}/tree/page.tsx` (`/mib/tree`, `/ib/tree`).
- Dùng API hiện có (`getSubtree`), chỉ đổi phần render.
- Dựng cây phân cấp thật (thu/phóng từng nhánh, accordion lồng nhau), mỗi
  node hiện: tên/email (KHÔNG hiện ID thô), role badge, active badge, số
  con trực tiếp nếu có.
- 1 component đệ quy React thuần là đủ, không cần thư viện graph.

---

## 5. Phase 7 — Tách nhỏ `CommissionManager.tsx` thành component con

Tách theo chức năng vào thư mục `src/components/commission-manager/`,
giữ nguyên hành vi/API call, chỉ tách file để dễ đọc/maintain — KHÔNG đổi
logic. Đề xuất chia theo:
- `DirectChildrenTable.tsx` — bảng con trực tiếp + set config.
- `CreateChildDialog.tsx`, `EditAccountDialog.tsx`, `SetConfigDialog.tsx`
  — các dialog nhỏ hiện có, tách file riêng.
- `ApplyTemplateDialog.tsx` — tách riêng, giữ nguyên logic Hướng 2 đã
  chốt (không đổi).
- Phần lõi (bảng + 2 dialog TK/config) sẽ là nội dung chính của route
  `${basePath}/config/page.tsx` ở Phase 8.

Nếu thấy hợp lý có thể gộp "Sửa TK" + "Set Config" + "Nhiều Asset" thành
1 luồng rõ ràng hơn (panel/drawer 1 chỗ thay vì 3 nút rời) — đề xuất
phương án cụ thể trước, không tự quyết định thay đổi UX lớn mà chưa xác
nhận.

---

## 6. Phase 8 — Route MIB/IB dùng Sidebar (thay thế hoàn toàn cách "tab ảo" cũ)

Làm SAU Phase 6 + Phase 7. Tạo cấu trúc **giống hệt nhau** dưới `app/mib/`
và `app/ib/`, mỗi route con là 1 wrapper mỏng gọi component đã tách ở
Phase 5-7 (hầu như không có logic mới):

```
app/mib/
  layout.tsx         — <RoleSidebarLayout basePath="/mib" roleLabel="MIB" items=... />
  page.tsx            — dashboard tóm tắt ngắn HOẶC redirect sang /mib/config
  tree/page.tsx        — Cây con cháu (Phase 6)
  config/page.tsx      — Con trực tiếp & Cấu hình (component từ Phase 7)
  templates/page.tsx   — Áp dụng Template (component đã tách, hiện dạng
                          trang đầy đủ thay vì dialog/modal — tận dụng
                          không gian màn hình vì đứng độc lập 1 mình)
  locks/page.tsx       — Khóa/Mở khóa Template (tương tự, dạng trang)
  assets/page.tsx      — Asset List (view-only)

app/ib/
  (cấu trúc giống hệt, cùng gọi chung component trong
  src/components/commission-manager/ và src/components/commission-hub/,
  chỉ khác basePath='/ib' → RoleSidebarLayout tự build đúng href)
```

**Ràng buộc quan trọng — giới hạn đúng phạm vi quyền:**
- Mỗi route con CHỈ gọi API mà MIB/IB thật sự được phép dùng theo đúng
  permission đã có ở backend — không route nào gọi API admin-only.
- MIB và IB dùng chung code nhưng KHÔNG cần FE tự phân biệt logic hiển
  thị theo role — backend đã tự trả đúng phạm vi dữ liệu theo token của
  actor gọi (ví dụ IB gọi `getSubtree` sẽ tự 403 theo đúng rule đã có,
  không cần FE tự ẩn link — nhưng NÊN ẩn bớt mục sidebar không dùng được
  nếu biết chắc role đó luôn bị chặn, để tránh người dùng bấm vào rồi
  thấy lỗi 403 khó hiểu — kiểm tra lại rule thật trước khi quyết định ẩn
  mục nào).

Xoá bỏ hoàn toàn state tab ảo (`useState` kiểu `activeTab`) trong
`mib/page.tsx` cũ nếu còn sót — không cần nữa vì dùng route thật.

---

## 7. Verify bắt buộc sau MỖI phase (5, 6, 7, 8)

1. `npm run build` — 0 lỗi TypeScript, xác nhận số static/dynamic page
   tăng đúng theo số route mới thêm trong phase đó.
2. `node test/test-flow-check.js` — phải giữ nguyên **96/96 PASS** xuyên
   suốt (đây thuần là thay đổi FE/routing, không đụng backend — nếu thấy
   cần đổi backend ở bất kỳ đâu, DỪNG LẠI báo cáo, không tự sửa).
3. Test tay + ảnh chụp (không crop) cho từng phase:
   - Phase 5: Admin — sidebar hiện đủ mục, bấm từng mục đổi URL thật,
     nội dung đúng, không mất chức năng so với bản tab cũ.
   - Phase 6: cây subtree hiện đúng, thu/phóng hoạt động.
   - Phase 7: xác nhận `npm run build` pass sau khi tách file (không sót
     import, không đổi hành vi).
   - Phase 8: MIB và IB — sidebar hiện đúng mục cho từng role, bấm từng
     mục đổi route thật, nội dung đúng. Xác nhận IB không thấy/không truy
     cập được các mục vượt quyền (ví dụ nếu route `tree` bị ẩn khỏi
     sidebar cho IB do biết chắc luôn 403, ghi rõ lý do trong báo cáo).

---

## 8. Báo cáo cuối cùng (sau khi xong Phase 5-8 hoặc dừng ở phase cần xác nhận)

1. Bảng từng phase: trạng thái (Done / Blocked — cần xác nhận thêm), danh
   sách route mới tạo, file component đã tách/tái cấu trúc.
2. Kết quả `npm run build` và `node test/test-flow-check.js` cuối cùng
   (phải là 96/96 PASS).
3. Danh sách việc KHÔNG tự làm vì ngoài phạm vi (nếu có phát sinh).
4. Ảnh chụp đầy đủ theo mục 7.3, cho cả 3 role.
5. Nếu có quyết định tự đưa ra khi thiếu thông tin (ví dụ `/admin`,
   `/mib`, `/ib` route gốc chọn dashboard tóm tắt hay redirect) — ghi rõ
   đã chọn phương án nào và vì sao.