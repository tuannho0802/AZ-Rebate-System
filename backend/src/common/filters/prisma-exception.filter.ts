import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Bắt riêng lỗi Prisma thô (Prisma.PrismaClientKnownRequestError /
 * PrismaClientUnknownRequestError) — những lỗi này KHÔNG phải HttpException
 * nên trước đây lọt qua mọi try/catch nghiệp vụ, rơi xuống thành 500 chung
 * chung, che mất nguyên nhân thật (vd vi phạm CHECK constraint DB, unique
 * constraint, foreign key...).
 *
 * ĐĂNG KÝ Ở main.ts, ĐẶT SAU (hoặc CÙNG CẤP với) GlobalExceptionFilter hiện
 * có — vì @Catch() ở đây chỉ khớp đúng 2 loại lỗi Prisma cụ thể, các
 * HttpException khác (403/400/404/409 do code nghiệp vụ tự throw) vẫn để
 * GlobalExceptionFilter xử lý như cũ, KHÔNG bị filter này can thiệp:
 *
 *   // main.ts
 *   app.useGlobalFilters(new GlobalExceptionFilter(), new PrismaExceptionFilter());
 *
 * (NestJS áp dụng global filter theo thứ tự đăng ký, filter nào có @Catch()
 * khớp type lỗi cụ thể sẽ được ưu tiên xử lý trước filter @Catch() không có
 * tham số / bắt tất cả — nên thứ tự truyền vào mảng ở trên không quan trọng
 * lắm, nhưng để rõ ràng cứ đặt PrismaExceptionFilter sau.)
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<{ url: string }>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Database error';

        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            switch (exception.code) {
                case 'P2002': // Unique constraint violation
                    status = HttpStatus.CONFLICT;
                    message = `Unique constraint violated on field(s): ${JSON.stringify(exception.meta?.target)}`;
                    break;
                case 'P2003': // Foreign key constraint violation
                    status = HttpStatus.BAD_REQUEST;
                    message = `Foreign key constraint violated: ${JSON.stringify(exception.meta?.field_name ?? exception.meta)}`;
                    break;
                case 'P2025': // Record not found (update/delete on missing row)
                    status = HttpStatus.NOT_FOUND;
                    message = 'Record not found';
                    break;
                default:
                    // Nhiều lỗi CHECK constraint thô của Postgres (vd sum check,
                    // non-negative, role-parent, ledger non-negative đã thêm tay vào
                    // migration) KHÔNG có mã P-code riêng của Prisma — chúng rơi vào
                    // đây. Giữ NGUYÊN VẸN message gốc (không cắt bớt dòng) vì Postgres
                    // thường kèm "DETAIL: Failing row contains (...)" — chính là phần
                    // quan trọng nhất để biết giá trị nào vi phạm, cắt mất sẽ vô dụng
                    // cho việc debug.
                    status = HttpStatus.BAD_REQUEST;
                    message = `Database constraint violation: ${exception.message}`;
            }
        } else {
            message = `Unknown database error: ${exception.message}`;
        }

        response.status(status).json({
            statusCode: status,
            message,
            error: HttpStatus[status] ?? 'Error',
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}