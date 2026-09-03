import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/** A failed-login window: how many tries an address gets, and for how long */
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  /** failed login attempts per client address */
  private attempts = new Map<string, { count: number; firstAt: number }>();

  /**
   * The staff key lives in the environment only. When it is missing every
   * staff route must fail closed - an unset key can never mean "let anyone in".
   */
  private get staffKey(): string {
    const key = process.env.ADMIN_KEY || '';

    if (!key) {
      throw new ServiceUnavailableException(
        'Staff sign-in is not configured on this server (ADMIN_KEY is unset)',
      );
    }

    return key;
  }

  /** Constant-time compare, via digests so differing lengths are safe */
  private matches(provided: string): boolean {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(this.staffKey).digest();

    return timingSafeEqual(a, b);
  }

  /** Used by the guard on every staff request; no rate limiting on the header */
  verify(provided?: string): boolean {
    return !!provided && this.matches(provided);
  }

  /** Used by the sign-in route, where guessing has to be made expensive */
  signIn(provided: string | undefined, client: string) {
    this.pruneAttempts();

    const record = this.attempts.get(client);

    if (record && record.count >= MAX_ATTEMPTS) {
      const minutes = Math.ceil((WINDOW_MS - (Date.now() - record.firstAt)) / 60000);

      throw new HttpException(
        `Too many failed sign-in attempts. Try again in ${minutes} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.verify(provided)) {
      this.attempts.set(client, {
        count: (record?.count || 0) + 1,
        firstAt: record?.firstAt || Date.now(),
      });

      throw new UnauthorizedException('Incorrect staff password');
    }

    this.attempts.delete(client);

    return { success: true, message: 'Signed in' };
  }

  private pruneAttempts() {
    const now = Date.now();

    for (const [client, record] of this.attempts) {
      if (now - record.firstAt > WINDOW_MS) {
        this.attempts.delete(client);
      }
    }
  }
}
