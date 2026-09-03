import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

/**
 * Protects everything that can mint, read or reset passes.
 * Guest and gate-scanner routes are deliberately left open:
 * - GET  /guests/verify/:token   attendee previewing their own pass
 * - POST /guests/register/:token attendee filling in their own details
 * - POST /guests/checkin/:token  the scanner app at the gate
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.auth.verify(readStaffKey(request))) {
      throw new UnauthorizedException('Staff sign-in required');
    }

    return true;
  }
}

function readStaffKey(request: Request): string | undefined {
  const header = request.headers['x-admin-key'];

  if (typeof header === 'string' && header) {
    return header;
  }

  const bearer = request.headers.authorization;

  return bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined;
}
