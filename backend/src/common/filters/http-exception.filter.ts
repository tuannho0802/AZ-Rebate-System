import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse = exception instanceof HttpException
            ? exception.getResponse()
            : null;

        const message = typeof exceptionResponse === 'object' && exceptionResponse !== null
            ? (exceptionResponse as any).message
            : exception instanceof HttpException ? exception.message : 'Internal server error';

        const error = typeof exceptionResponse === 'object' && exceptionResponse !== null
            ? (exceptionResponse as any).error
            : HttpStatus[status];

        response.status(status).json({
            statusCode: status,
            message,
            error,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}