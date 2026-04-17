import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import * as Joi from "joi";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { CurrencyModule } from "../../currency/currency.module";

const parseBoolean = (
  value: string | undefined,
  defaultValue = false,
): boolean => {
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
};

const resolveDbSsl = (
  config: ConfigService,
): false | { rejectUnauthorized: boolean } => {
  const sslMode = config.get<string>("PGSSLMODE")?.toLowerCase();
  if (sslMode === "disable") return false;
  if (
    sslMode === "require"
    || sslMode === "verify-ca"
    || sslMode === "verify-full"
  ) {
    return {
      rejectUnauthorized: parseBoolean(
        config.get<string>("DB_SSL_REJECT_UNAUTHORIZED"),
        false,
      ),
    };
  }

  const explicitSsl =
    config.get<string>("DB_SSL") ?? config.get<string>("TYPEORM_SSL");
  if (explicitSsl !== undefined) {
    if (parseBoolean(explicitSsl, false)) {
      return {
        rejectUnauthorized: parseBoolean(
          config.get<string>("DB_SSL_REJECT_UNAUTHORIZED"),
          false,
        ),
      };
    }
    return false;
  }

  const databaseUrl = config.get<string>("DATABASE_URL") ?? "";
  const dbHost = config.get<string>("DB_HOST") ?? "";
  const usesNeon = databaseUrl.includes("neon.tech") || dbHost.includes("neon.tech");
  const isProduction = config.get<string>("NODE_ENV") === "production";

  if (usesNeon || isProduction) {
    return {
      rejectUnauthorized: parseBoolean(
        config.get<string>("DB_SSL_REJECT_UNAUTHORIZED"),
        false,
      ),
    };
  }

  return false;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "apps/auth-service/.env",
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid("development", "test", "production")
          .default("development"),
        PORT: Joi.number().integer().min(1).max(65535).default(3001),
        DATABASE_URL: Joi.string().optional(),
        DB_HOST: Joi.string().optional(),
        DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
        DB_USER: Joi.string().optional(),
        DB_PASSWORD: Joi.string().optional(),
        DB_PASS: Joi.string().optional(),
        DB_NAME: Joi.string().optional(),
        DB_SSL: Joi.string().valid("true", "false", "1", "0").optional(),
        TYPEORM_SSL: Joi.string().valid("true", "false", "1", "0").optional(),
        DB_SSL_REJECT_UNAUTHORIZED: Joi.string()
          .valid("true", "false", "1", "0")
          .optional(),
        PGSSLMODE: Joi.string()
          .valid("disable", "require", "verify-ca", "verify-full")
          .optional(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
        BREVO_API_KEY: Joi.string().optional(),
        BREVO_FROM_EMAIL: Joi.string().email().optional(),
        BREVO_FROM_NAME: Joi.string().optional(),
        ALLOWED_ORIGINS: Joi.string().when("NODE_ENV", {
          is: "production",
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        ENABLE_SWAGGER: Joi.string()
          .valid("true", "false", "1", "0")
          .default("false"),
        TYPEORM_SYNCHRONIZE: Joi.string()
          .valid("true", "false", "1", "0")
          .default("false"),
        TYPEORM_LOGGING: Joi.string()
          .valid("true", "false", "1", "0")
          .default("false"),
      })
        .custom((value, helpers) => {
          if (!value.DATABASE_URL) {
            if (!value.DB_HOST || !value.DB_USER || !value.DB_NAME) {
              return helpers.message({
                custom:
                  "Set DATABASE_URL or set DB_HOST, DB_USER, and DB_NAME.",
              });
            }

            if (!value.DB_PASSWORD && !value.DB_PASS) {
              return helpers.message({
                custom: "Set DB_PASSWORD or DB_PASS when DATABASE_URL is not used.",
              });
            }
          }

          if (value.NODE_ENV !== "production") return value;
          if (!value.BREVO_API_KEY || !value.BREVO_FROM_EMAIL) {
            return helpers.message({
              custom:
                "In production, BREVO_API_KEY and BREVO_FROM_EMAIL are required.",
            });
          }
          return value;
        }),
      validationOptions: {
        allowUnknown: true,
      },
    }),

    ThrottlerModule.forRoot([
      { name: "short", ttl: 1000, limit: 3 },
      { name: "medium", ttl: 10000, limit: 20 },
      { name: "long", ttl: 60000, limit: 100 },
    ]),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        ...(config.get<string>("DATABASE_URL")
          ? {
            url: config.getOrThrow<string>("DATABASE_URL"),
          }
          : {
            host: config.getOrThrow<string>("DB_HOST"),
            port: config.get<number>("DB_PORT", 5432),
            username: config.getOrThrow<string>("DB_USER"),
            password:
              config.get<string>("DB_PASSWORD") ??
              config.getOrThrow<string>("DB_PASS"),
            database: config.getOrThrow<string>("DB_NAME"),
          }),
        ssl: resolveDbSsl(config),
        autoLoadEntities: true,
        synchronize: parseBoolean(
          config.get<string>("TYPEORM_SYNCHRONIZE"),
          false,
        ),
        logging: parseBoolean(config.get<string>("TYPEORM_LOGGING"), false),
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    TenantsModule,
    CurrencyModule,
  ],
})
export class AppModule {}
