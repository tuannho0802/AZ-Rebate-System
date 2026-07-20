import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { setupSwagger } from './swagger/swagger-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Serve static files from 'public' directory
  app.useStaticAssets('public');
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // PrismaExceptionFilter bắt riêng Prisma.PrismaClientKnownRequestError /
  // PrismaClientUnknownRequestError (lỗi CHECK/unique/FK constraint thô từ
  // DB) — trước đây những lỗi này KHÔNG phải HttpException nên lọt qua
  // HttpExceptionFilter, rơi xuống thành 500 "Internal server error" chung
  // chung, che mất nguyên nhân thật. Đăng ký thêm filter này để tự map về
  // đúng status code + message đọc được (vd tên CHECK constraint vi phạm).
  // HttpExceptionFilter vẫn xử lý mọi HttpException (403/400/404/409...) do
  // code nghiệp vụ tự throw như cũ, không bị ảnh hưởng.
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
  app.enableCors({
    origin: ['http://localhost:3001'],
    credentials: true,
  });
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();