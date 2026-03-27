import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { JwtPayload } from '../../../../libs/common/src/types/jwt-payload.type';
import { TenantContext } from './tenant-context';

type RequestWithUser = {
  user?: JwtPayload;
};

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const tenantId = user?.tenantId;

    if (user && !tenantId) {
      throw new UnauthorizedException('Token missing tenantId');
    }

    return new Observable((subscriber) => {
      let subscription: { unsubscribe: () => void } | undefined;

      TenantContext.runWithTenant(tenantId, () => {
        subscription = next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });

      return () => subscription?.unsubscribe();
    });
  }
}
