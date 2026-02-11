import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';
import { LogoutDto } from './dto/logout.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.authService.signup(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req.ip, req.headers['user-agent']);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: JwtUser,
    @Body() dto: LogoutDto,
    @Req() req: Request,
  ) {
    return this.authService.logout(
      user,
      dto.refreshToken,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
