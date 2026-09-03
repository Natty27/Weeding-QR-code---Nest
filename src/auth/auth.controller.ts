import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminGuard } from './admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /**
   * Checks the staff password. There is no session: the client keeps the key
   * and sends it as `x-admin-key` on every staff request.
   */
  @Post('login')
  login(@Body('key') key: string, @Ip() ip: string) {
    return this.auth.signIn(key, ip || 'unknown');
  }

  /** Lets the admin page confirm a stored key is still valid */
  @Get('check')
  @UseGuards(AdminGuard)
  check() {
    return { success: true, staff: true };
  }
}
