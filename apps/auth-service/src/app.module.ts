import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import * as Joi from "joi";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";

const parseBoolean = (
  value: string | undefined,
  defaultValue = false,
): boolean => {
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
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
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().optional(),
        DB_PASS: Joi.string().optional(),
        DB_NAME: Joi.string().required(),
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
        .or("DB_PASSWORD", "DB_PASS")
        .custom((value, helpers) => {
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
        host: config.getOrThrow<string>("DB_HOST"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.getOrThrow<string>("DB_USER"),
        password:
          config.get<string>("DB_PASSWORD") ??
          config.getOrThrow<string>("DB_PASS"),
        database: config.getOrThrow<string>("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
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
  ],
})
export class AppModule {}
