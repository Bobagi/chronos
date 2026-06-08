import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      username: string;
      password: string;
      role?: 'USER' | 'ADMIN';
    },
  ) {
    return this.authService.register(
      body.username,
      body.password,
      body.role ?? 'USER',
    );
  }

  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('avatar')
  updateAvatar(
    @CurrentUser() user: { sub: string },
    @Body() body: { avatarUrl: string },
  ) {
    return this.authService.updateAvatar(user.sub, body.avatarUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(
    @CurrentUser() user: { sub: string },
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('username')
  changeUsername(
    @CurrentUser() user: { sub: string },
    @Body() body: { username: string },
  ) {
    return this.authService.changeUsername(user.sub, body.username);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteAccount(@CurrentUser() user: { sub: string }) {
    return this.authService.deleteAccount(user.sub);
  }
}
