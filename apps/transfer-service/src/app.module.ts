import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { Transfer } from "./entities/transfer.entity";
import { TransferService } from "./transfer/transfer.service";
import { TransferController } from "./transfer/transfer.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.get("DB_USER"),
        password: config.get("DB_PASS"),
        database: config.get("DB_NAME"),
        entities: [Transfer],
        synchronize: config.get("NODE_ENV") !== "production",
        logging: config.get("NODE_ENV") === "development",
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Transfer]),
  ],
  controllers: [TransferController],
  providers: [TransferService],
})
export class TransferModule {}
