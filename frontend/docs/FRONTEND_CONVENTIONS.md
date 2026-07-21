# Frontend Conventions — Rebate System (Next.js App Router)

Quy ước dựa trên code đã có trong `frontend/src/`. Vài mục còn TODO cần bạn
xác nhận thêm (đánh dấu rõ bên dưới) — không tự bịa để tránh lệch với ý định
thật của bạn.

## 1. Cấu trúc thư mục hiện tại

```
src/
├── app/
│   ├── admin/page.tsx      ← dashboard Admin
│   ├── config/page.tsx     ← quản lý commission config (dùng chung nhiều role?)
│   ├── ib/page.tsx         ← dashboard IB
│   ├── login/page.tsx
│   ├── mib/page.tsx        ← dashboard MIB
│   ├── sessions/page.tsx   ← PayoutSession + Ledger
│   ├── layout.tsx
│   └── page.tsx            ← trang gốc, có thể là redirect theo role
├── components/
│   └── commission-manager.tsx
├── context/
│   └── auth-context.tsx
├── hooks/
└── lib/
    ├── api-client.ts       ← generic fetch wrapper
    ├── jwt.ts               ← decode/lưu token
    └── mock-store.ts        ← ĐANG dùng song song, cần xác định phạm vi còn lại
```

> **Đã audit (đợt kiểm tra gần nhất)**: `mock-store.ts` KHÔNG còn được import
> ở bất kỳ page nào (`admin`, `config`, `sessions`, `mib`, `ib`, `login` đều
> đã chuyển hết sang gọi API thật qua `api-client.ts`). File này an toàn để
> xoá khỏi `lib/` nếu không còn dùng cho việc khác (VD storybook/test riêng),
> hoặc giữ lại làm tài liệu tham khảo shape dữ liệu nếu muốn.

## 2. `api-client.ts` — pattern gọi API

File hiện tại là **generic wrapper**, không có hàm riêng theo từng route:
```ts
api.get<T>(endpoint, init?)
api.post<T>(endpoint, body?, init?)
api.patch<T>(endpoint, body?, init?)
api.delete<T>(endpoint, init?)
```
Tự động đọc token từ cookie (`document.cookie` key `token`) và gắn header
`Authorization: Bearer <token>`. Lỗi HTTP (`!response.ok`) được throw thành
`Error` kèm `.status` và `.body` (chứa đúng shape lỗi chuẩn từ backend —
xem `API_REFERENCE.md`).

**Quy ước đề xuất**: gom các lệnh gọi API theo domain thành file riêng trong
`lib/api/`, KHÔNG gọi `api.get('/commission-configs/...')` rải rác trực tiếp
trong component — để 1 chỗ duy nhất biết chính xác path/shape của từng
route, dễ audit khi backend đổi API:

```
lib/api/
├── commission-config.ts   // getTree, getChildren, upsert, update
├── payout-session.ts       // list, create, lock, complete, getOne, getLedger
├── template.ts              // list, create, update, delete, apply
├── user.ts                  // list, getOne, create, update, getSubtree
├── admin.ts                  // asset CRUD, template CRUD (phần admin), integrityCheck
```

Mỗi hàm export nên có type rõ ràng cho param/response, khớp `API_REFERENCE.md`.

## 3. Xử lý lỗi — bắt theo `error.status`

Vì `api-client.ts` đã gắn `.status`/`.body` vào `Error`, pattern xử lý nên
thống nhất:

```ts
try {
  await upsertConfig(dto);
} catch (err) {
  if (err.status === 409) {
    // "Dữ liệu đã bị thay đổi, tải lại trang" — GET lại rồi cho thử tiếp
  } else if (err.status === 403) {
    // Không nên xảy ra nếu UI đã ẩn action đúng theo role — log để soát lại
  } else if (err.status === 400) {
    // Hiện thẳng err.body.message — backend đã trả message tiếng Việt rõ ràng
  }
}
```

Xem bảng đầy đủ mã lỗi cần xử lý riêng ở cuối `API_REFERENCE.md`.

## 4. Auth — `auth-context.tsx`

- `login(email, password, type: 'admin' | 'user')` gọi đúng endpoint tương
  ứng, decode token, lưu vào cookie (hết hạn 1 ngày, khớp `JWT_EXPIRES_IN`
  mặc định backend).
- `user: JwtPayload | null` — chứa `{ sub, email, type: 'admin'|'user', role? }`
  sau khi decode (✅ đã sửa 21/7/2026, xác nhận qua code thật — xem
  `API_REFERENCE.md`; field là `sub` chữ thường, KHÔNG phải `id`, và `type`
  chữ thường, KHÔNG phải chữ HOA như bản ghi cũ). Dùng `user.type`/`user.role`
  để quyết định route/UI, KHÔNG gọi thêm API chỉ để biết role.
- Route guard (ở `layout.tsx` hoặc middleware): nếu `!user` → redirect
  `/login`. Nếu `user.type === 'ADMIN'` → cho vào `/admin`. Nếu
  `user.role === 'MIB'` → `/mib`. Nếu `role === 'IB'` → `/ib`. Chặn truy cập
  chéo (VD IB gõ thẳng URL `/admin`).

> **Đã audit (đợt kiểm tra gần nhất)**: `layout.tsx` hiện CHƯA có route guard
> tập trung — chỉ wrap `AuthProvider`. Việc kiểm tra quyền truy cập đang được
> lặp lại RIÊNG LẺ ở từng page (`admin/page.tsx`, `config/page.tsx`,
> `sessions/page.tsx`, `mib/page.tsx`, `ib/page.tsx`). Hoạt động đúng ở hiện
> tại, nhưng là nợ kỹ thuật: mỗi page mới thêm sau này phải tự nhớ thêm lại
> đúng logic redirect — dễ quên hoặc viết lệch nhau giữa các page theo thời
> gian. **Đề xuất cải tiến** (chưa cấp bách, làm khi có thời gian): gom logic
> guard vào 1 chỗ duy nhất — hoặc Next.js Middleware (`middleware.ts` ở gốc
> `src/`, chạy trước khi vào bất kỳ route nào), hoặc 1 component
> `<RoleGuard allow={['ADMIN']}>` dùng chung, bọc quanh nội dung mỗi
> `page.tsx` thay vì mỗi page tự viết lại đoạn kiểm tra `user.type`/`user.role`.

## 5. Quy ước hiển thị theo Business Rules

Bám sát `BUSINESS_RULES.md` khi build UI, cụ thể:

- **Trang config** (`config/page.tsx`, `commission-manager.tsx`): trước khi
  hiện nút "Sửa" cho 1 dòng config, kiểm tra `actor` hiện tại có phải cha
  TRỰC TIẾP của user đó không (so `actor.id === node.parentId`), KHÔNG chỉ
  dựa vào role chung chung — vì rule đã siết "chỉ cha trực tiếp", không phải
  "bất kỳ ai trong subtree".
- Khi hiện form sửa, LUÔN kèm `version` ẩn (hidden field/state) lấy từ lần
  GET gần nhất, gửi lại nguyên vẹn trong PATCH.
- Khi Admin sửa config MIB root, cảnh báo UI nếu giá trị mới thấp hơn 1 con
  trực tiếp nào đó đang giữ (biết trước sẽ bị 400, tốt hơn là disable nút
  Submit + hiện gợi ý ngay tại chỗ, thay vì để user bấm rồi nhận lỗi).
- **Trang apply Template**: nếu Template có item `(0,0)`, hiện rõ trong
  preview rằng item đó "sẽ KHÔNG được áp dụng" (đã lọc bỏ ở backend), tránh
  Admin hiểu nhầm là "áp thành công cả item này".
- **Trang apply Template — danh sách chọn**: KHÔNG gọi thẳng `GET
  /admin/templates` để hiện lựa chọn cho user tự áp. Với MIB/IB, phải gọi
  `GET /templates/visible` (đã trừ sẵn các template bị cha lock riêng cho
  user đó) — xem `API_REFERENCE.md` mục Template Lock/Unlock/Visible. Nếu lỡ
  dùng nhầm route Admin, user có thể tự áp cả template đã bị cha khoá.
- **Action Lock/Unlock template cho con**: form chọn Template để lock PHẢI
  lọc theo đúng `level` của user target trước khi hiện lên UI (không hiện
  tất cả rồi để bấm nhầm) — vì backend trả 400 nếu `template.level` không
  khớp level của user, xem `BUSINESS_RULES.md` mục 3a. Nút Lock/Unlock chỉ
  hiện với đúng cha TRỰC TIẾP của user đang xem, ẩn hẳn (không chỉ disable)
  với MIB xem cháu hoặc IB không liên quan.
- **Trang sessions**: disable nút Lock/Complete dựa vào `status` hiện tại
  (`DRAFT`/`LOCKED`/`COMPLETED`) ngay từ khi render, không chỉ chờ lỗi 409.

## 6. Format code / style

> **TODO cần xác nhận**: dự án có dùng ESLint/Prettier config sẵn không
> (thấy `.gitignore`, `AGENTS.md`, `CLAUDE.md` ở root nhưng chưa xác nhận
> nội dung 2 file này có quy định style riêng chưa). Nếu có, dán nội dung
> `AGENTS.md`/`CLAUDE.md` hiện tại vào đây để hợp nhất, tránh 2 nguồn quy
> ước xung đột nhau.