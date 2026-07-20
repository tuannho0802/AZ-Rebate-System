import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication) {
  const version = '0.0.1';

  const config = new DocumentBuilder()
    .setTitle('Rebate System API')
    .setDescription('API documentation for Rebate System - Commission Config, Payout Sessions, Asset & Template Management')
    .setVersion(version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'access-token',
        description: 'Enter JWT token to authorize requests',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api-docs', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customJs: [
      '/swagger-ui-init.js',
    ],
  });
}
