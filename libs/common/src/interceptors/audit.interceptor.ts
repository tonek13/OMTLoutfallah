import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AUDIT');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip } = req;
    const userId = user?.sub || 'anonymous';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} | user:${userId} | ip:${ip} | ${ms}ms`);
        },
        error: (err) => {
          this.logger.warn(
            `${method} ${url} | user:${userId} | ip:${ip} | ERROR: ${err.message}`,
          );
        },
      }),
    );
  }
}
