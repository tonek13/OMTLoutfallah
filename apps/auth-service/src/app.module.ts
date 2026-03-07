import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/auth-service/.env',
    }),

    // Rate limiting — critical for auth endpoints
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 3   },  // 3 req/sec
      { name: 'medium', ttl: 10000, limit: 20  },  // 20 req/10sec
      { name: 'long',   ttl: 60000, limit: 100 },  // 100 req/min
    ]),

    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'omt_user',
      password: 'omt_password',
      database: 'omt_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: true,
    }),

    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
