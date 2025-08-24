import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      username: string;
      password: string;
      role?: 'USER' | 'ADMIN';
    },
  ) {
    return this.auth.register(
      body.username,
      body.password,
      (body.role as any) ?? 'USER',
    );
  }

  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { sub: string }) {
    return this.auth.me(user.sub);
  }
}
