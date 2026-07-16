# Conflict & Decisions

1. **[ĐÃ XÁC NHẬN]** Rebate/Markup ràng buộc RIÊNG lẻ, không chỉ tổng: `rebateUnit(con) ≤ rebateUnit(cha)` VÀ `markupPips(con) ≤ markupPips(cha)` phải đúng cả hai. Không được phối lại tỷ lệ khác cha dù tổng transferUnit vẫn hợp lệ.
2. **[ĐÃ XÁC NHẬN]** Chỉ Admin được tạo/lock/complete `PayoutSession`. MIB/IB không có quyền tự chốt hoa hồng nhánh mình.
3. **Reparent (đổi cha)**: chưa triển khai ở phase này. Nếu làm sau, phải re-validate toàn bộ subtree khi đổi cha (không chỉ node đang đổi), và re-check lại rule 1 theo cha mới cho toàn bộ chuỗi con cháu.
4. **[ĐÃ XÁC NHẬN]** Không hard-delete, chỉ `isActive` toggle. Khi tắt 1 node giữa cây, **con của nó vẫn hoạt động độc lập** — KHÔNG cascade tắt theo nhánh. Việc tính Net pips vẫn tự động bỏ qua node inactive theo rule 3.5 (mục Business Rules), không cần con phải bị tắt theo mới hoạt động đúng.
5. **Orphan config**: chặn tạo config asset cho user nếu chuỗi cha lên root chưa có config asset đó — cần enforce ở service layer khi tạo `UserCommissionConfig`.
6. **Race condition**: dùng `version` (optimistic lock) trên `UserCommissionConfig`; FE/API phải gửi kèm `version` hiện tại khi update, nếu lệch → 409 Conflict.
7. **Hiệu năng cây lớn**: hiện dùng thuần `parentId` + Recursive CTE. Nếu sau này số user lớn (>chục nghìn) và cần load cây nhiều lần, cân nhắc thêm bảng closure table hoặc materialized path — **để sau, không làm ở phase này** theo yêu cầu người dùng.
8. **[CẦN XÁC NHẬN] GAUCNH**: chưa rõ nghĩa nghiệp vụ, seed tạm với category OTHER, tên hiển thị = code. Cần người dùng xác nhận lại tên hiển thị & category chính xác trước khi dùng ở môi trường thật.
9. **CommissionLedger sau khi COMPLETED**: không cho update/delete — enforce ở service layer (kiểm tra `PayoutSession.status` trước khi cho phép ghi thêm ledger entry).
10. **[ĐÃ XÁC NHẬN]** Config gốc của MIB (root, `parentId = null`) chỉ Admin được tạo/sửa — MIB không tự set hoặc tự nâng trần config của chính mình. Rule "≤ cha" (mục 1) không áp dụng cho root vì không có cha, nhưng đổi lại bị khoá quyền ghi chỉ cho Admin.
