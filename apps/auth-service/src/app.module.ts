import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/auth-service/.env',
    }),

    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 3   }, 
      { name: 'medium', ttl: 10000, limit: 20  },  
      { name: 'long',   ttl: 60000, limit: 100 }, 
    ]),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'omt_user'),
        password:
          config.get<string>('DB_PASSWORD') ??
          config.get<string>('DB_PASS', 'omt_password'),
        database: config.get<string>('DB_NAME', 'omt_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
