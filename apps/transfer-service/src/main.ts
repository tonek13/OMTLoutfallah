import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransferModule } from './app.module';
import helmet from 'helmet';

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

async function bootstrap() {
  const app = await NestFactory.create(TransferModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const enableSwagger = parseBoolean(process.env.ENABLE_SWAGGER, !isProduction);

  app.use(helmet());
  app.enableCors({
    origin: isProduction ? allowedOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.setGlobalPrefix('api/v1');

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('OMT Transfer Service')
      .setDescription('Money transfer API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT || 3002);
  await app.listen(port);
  console.log(`Transfer Service running on port ${port}`);
}

bootstrap();
