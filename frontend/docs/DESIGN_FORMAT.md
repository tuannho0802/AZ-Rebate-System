# Design Format — Chuẩn UI Admin Console

> File này là chuẩn tham chiếu bắt buộc cho mọi trang trong khu vực `admin`, `mib`, `ib`.
> Design gốc lấy theo 2 trang đã đúng chuẩn: **Commission Configs** và **Payout Sessions**.
> Agent phải đọc file này trước khi tạo mới hoặc chỉnh sửa bất kỳ page nào trong hệ thống.

---

## 1. Nguyên tắc chung

- **Không có banner/header riêng ở đầu trang.** Không dùng `TopNav`, không có thanh màu nền tím/xanh chứa tiêu đề trang, không có nút "Quay lại Admin" hay nút "Đăng xuất" thứ hai.
- **Không có heading lớn (`<h1>`) nằm ngoài Card** ở đầu trang. Nội dung trang bắt đầu thẳng bằng component `Card`.
  - Ngoại lệ: nếu 1 trang chỉ có đúng 1 danh sách chính (ví dụ Users, Assets), tiêu đề trang được đặt **bên trong** `Card` dưới dạng `title` prop, không phải `<h1>` rời bên ngoài.
- Toàn bộ nội dung nằm trong layout dùng chung (sidebar bên trái cố định + phần nội dung bên phải), không trang nào tự vẽ layout riêng.
- Nút "Đăng xuất" **chỉ tồn tại duy nhất 1 chỗ**: trong sidebar dùng chung, không lặp lại ở bất kỳ trang con nào.

---

## 2. Cấu trúc chuẩn 1 trang

Tham chiếu đúng theo `Commission Configs` và `Payout Sessions`:

```tsx
export default function SomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/login'); return; }
    // check role tương ứng
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (!user /* || role không hợp lệ */) return null;

  return (
    <PageShell>
      <PageBody>
        <Card
          title="Tên section"
          description="Mô tả ngắn gọn mục đích section"
          actions={/* nút hành động nếu có, ví dụ Refresh, + Tạo mới */}
        >
          {/* nội dung: form, table, v.v. */}
        </Card>

        {/* Có thể có nhiều Card xếp dọc trong cùng 1 trang,
            ví dụ Payout Sessions có 2 Card: "Tạo mới" + "Danh sách" */}
      </PageBody>
    </PageShell>
  );
}
```

**Lưu ý bắt buộc:**
- Luôn có check `isLoading` trước khi quyết định redirect (tránh lặp lại bug race-condition F5 logout đã fix trước đó).
- Không import `TopNav` — component này đã bị loại bỏ khỏi hệ thống, không được dùng lại kể cả khi tạo trang mới.

---

## 3. Component `Card`

Đây là khối nội dung chính, thay thế hoàn toàn cho header/banner cũ.

| Prop | Bắt buộc | Mô tả |
|---|---|---|
| `title` | Có | Tên section, hiển thị đậm, cỡ chữ lớn hơn nội dung |
| `description` | Nên có | Câu mô tả ngắn dưới title, màu chữ nhạt hơn |
| `actions` | Tuỳ trang | Vùng chứa nút hành động, canh phải cùng hàng với title (ví dụ `Refresh`, `+ Tạo mới`) |

Ví dụ tham chiếu thực tế đã đúng chuẩn:
- **Commission Configs**: Card "Cấu hình hoa hồng hệ thống" (chọn Asset + User để xem cây phân cấp) → Card "Thiết lập cấu hình mới" (form tạo config).
- **Payout Sessions**: Card "Tạo Payout Session mới" (form) → Card "Danh sách Payout Sessions" (bảng dữ liệu).

Nhiều Card trong 1 trang được xếp dọc, cách nhau bằng khoảng trắng đều (`space-y-6` hoặc tương đương), không có đường viền phân cách rời rạc giữa các Card.

---

## 4. Bảng dữ liệu (Table)

Dùng chung component `Table`, `Th`, `Td`, `Badge` như đã dùng ở Users / Assets / Payout Sessions:

- Header cột viết HOA, màu chữ nhạt (`text-slate-500` hoặc tương đương), không in đậm.
- Trạng thái (Active/Inactive, Completed/Draft...) hiển thị bằng `Badge` có chấm tròn màu ở đầu, không dùng text thuần.
- Cột thao tác (Sửa / Xoá / Xem) canh phải, dùng link/button dạng text nhỏ, không dùng icon-only nếu không có tooltip.
- Bảng luôn nằm trong 1 `Card`, không đứng độc lập ngoài Card.

---

## 5. Form nhập liệu

Tham chiếu theo form "Tạo Payout Session mới" và "Thiết lập cấu hình mới":

- Label nằm phía trên input, không nằm bên trái theo hàng ngang.
- Input, Select xếp theo lưới nhiều cột trên desktop (grid 2–3 cột tuỳ số field), tự động xuống dòng trên màn nhỏ.
- Trường bắt buộc đánh dấu `*` màu đỏ ngay sau label.
- Nút submit chính (màu xanh lá hoặc tím theo action) đặt canh phải, dưới cùng form.
- Placeholder viết ví dụ cụ thể (ví dụ: "Ví dụ: Payout Session Tháng 07/2026") thay vì chỉ ghi tên field.

---

## 6. Điều hướng phụ (Tabs)

Nếu 1 section có nhiều chế độ xem (ví dụ Commission Configs có "Cây phân cấp (Full Tree)" / "Con trực tiếp (Direct Children)"):

- Dùng dạng tab ngang, tab đang chọn có gạch chân màu tím/indigo, chữ đậm hơn tab còn lại.
- Tab nằm ngay dưới phần chọn filter (Asset/User), phía trên Card nội dung chi tiết.

---

## 7. Những gì KHÔNG được làm

- ❌ Không thêm banner màu nền chứa tên hệ thống ("Rebate System — ...") ở đầu trang.
- ❌ Không thêm nút "Đăng xuất" hoặc "Quay lại Admin" ở bất kỳ đâu ngoài sidebar dùng chung.
- ❌ Không dùng `<h1>` rời đứng ngoài `Card` làm tiêu đề trang.
- ❌ Không import hoặc tái tạo lại component `TopNav`.
- ❌ Không tự viết layout riêng (sidebar riêng, wrapper riêng) cho từng trang — luôn dùng `PageShell` + `PageBody` dùng chung.

---

## 8. Checklist trước khi bàn giao 1 trang mới/sửa

- [ ] Không còn banner/header riêng ở đầu trang.
- [ ] Không còn `<h1>` rời ngoài Card.
- [ ] Dùng đúng `PageShell` + `PageBody` + `Card`.
- [ ] Có check `isLoading` trước khi redirect.
- [ ] Không import `TopNav`.
- [ ] Bảng dùng đúng `Table/Th/Td/Badge`.
- [ ] Form đúng layout lưới, có `*` cho field bắt buộc.
- [ ] Đã chụp ảnh so sánh với Commission Configs / Payout Sessions để đối chiếu trực quan.