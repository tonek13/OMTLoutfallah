import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import compression = require("compression");
import { AppModule } from "./app.module";

const TEMPLATE_SIGNATURE =
  "omt-v2-starter | owner: Tony Loutfallah | id: tony-loutfallah-v1";

const parseBoolean = (
  value: string | undefined,
  defaultValue = false,
): boolean => {
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const enableSwagger = parseBoolean(process.env.ENABLE_SWAGGER, !isProduction);

  // Security
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: isProduction
      ? allowedOrigins.includes("*")
        ? "*"
        : allowedOrigins
      : true,
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle("OMT Auth Service")
      .setDescription("Authentication, tenant, currency, and wallet API")
      .setVersion("2.0")
      .addBearerAuth()
      .addApiKey(
        {
          type: "apiKey",
          in: "header",
          name: "x-tenant-id",
          description:
            "Tenant context header required by tenant-scoped wallet endpoints.",
        },
        "tenant-id",
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`Auth Service running on port ${port}`);
  console.log(`Template signature: ${TEMPLATE_SIGNATURE}`);
}
bootstrap();
