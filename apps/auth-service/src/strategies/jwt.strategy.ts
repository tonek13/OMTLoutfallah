import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../modules/users/user.entity';
import type { JwtPayload } from '../../../../libs/common/src/types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: Partial<JwtPayload>) {
    if (!payload?.sub || !payload.tenantId) {
      throw new UnauthorizedException();
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status === 'blocked' || user.status === 'suspended') throw new UnauthorizedException();
    return { id: user.id, phone: user.phone, role: user.role, tenantId: payload.tenantId };
  }
}
