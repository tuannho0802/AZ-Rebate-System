# Backend Setup — Rebate System

Hướng dẫn chạy backend NestJS từ số 0. Không phải hệ thống trade thật — chỉ tính
toán và lưu vết hoa hồng đa cấp để đối soát thủ công.

## 1. Yêu cầu môi trường

- **Node.js >= 18** (bắt buộc để dùng global `fetch` trong script test).
- **PostgreSQL** đang chạy, đã tạo sẵn database (tên gợi ý: `rebate_system_db`).
- Windows + PowerShell (môi trường phát triển hiện tại). Lệnh liệt kê file dùng
  `Get-ChildItem -Recurse`, KHÔNG dùng `dir /s /b`.

## 2. Cài đặt

```powershell
cd backend
npm install
```

## 3. Biến môi trường (`.env`)

Tạo file `.env` ở thư mục `backend/` với tối thiểu:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/rebate_system_db"
JWT_SECRET="<chuỗi bí mật bất kỳ, đủ dài>"
JWT_EXPIRES_IN="1d"
PORT=3000
```

- `JWT_SECRET` bắt buộc phải có — `auth.module.ts` sẽ throw lỗi ngay lúc khởi
  động nếu thiếu (`JWT_SECRET chưa được set trong .env`).
- `JWT_EXPIRES_IN` optional, mặc định `1d` nếu bỏ trống.
- `PORT` optional, mặc định `3000`.

Xem thêm `.env.example` đi kèm trong repo để copy nhanh.

## 4. Migration + generate Prisma Client

```powershell
npx prisma migrate dev
npx prisma generate
```

Xem chi tiết schema và cách seed dữ liệu ở [`DATABASE.md`](./DATABASE.md).

## 5. Chạy server (dev, watch mode)

```powershell
npm run start:dev
```

Server chạy tại `http://localhost:3000`. Swagger UI (tài liệu API tương tác,
có auto-authorize sau khi login) tại `http://localhost:3000/api-docs`.

## 6. Xác nhận server sống

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/" -Method GET
```

Kỳ vọng trả về chuỗi chào (route `GET /`, `AppController.getHello()`).

## 7. Chạy test tự động (smoke test toàn bộ nghiệp vụ)

```powershell
cd test
node test-flow-check.js
```

Script này tự tạo/xoá dữ liệu test riêng (suffix theo `RUN_ID = Date.now()`),
an toàn chạy lại nhiều lần, không đụng tới seed account cố định (ngoại trừ 1
số case cố ý set config lên các account seed để test rule cha-con — xem
[`BUSINESS_RULES.md`](./BUSINESS_RULES.md) nếu cần hiểu rõ tác dụng phụ này).

Kỳ vọng: **70/70 PASS**. Mục cuối (Integrity Check) luôn PASS bất kể có vi
phạm cha-con hay không — nó chỉ log chi tiết, không assert cứng. Nếu log báo
còn vi phạm, xem hướng dẫn dọn dữ liệu ở `DATABASE.md` mục "Dọn dữ liệu lệch".

## 8. Các lỗi khởi động thường gặp (đã từng xảy ra trong dự án này)

| Log thấy | Nguyên nhân | Cách fix |
|---|---|---|
| `InstanceLoader XModule dependencies initialized` nhưng KHÔNG có dòng `RoutesResolver XController` theo sau | Module đăng ký `@Module({})` rỗng (không có `controllers`/`providers`) | Kiểm tra `imports`/`controllers`/`providers` trong module đó |
| `UnknownDependenciesException ... Please make sure X is available` | Service cần inject 1 service khác nhưng module chưa `imports` module chứa service đó | Thêm module thiếu vào mảng `imports` |
| Log có `Duplicate DTO detected: <Tên>` | 2 class DTO khác nhau trùng tên (Swagger không phân biệt được) | Đổi tên 1 trong 2 class, cập nhật import ở nơi dùng |
