import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthDto } from './auth-dto';
import { SupabaseGuard } from './guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**Signup */
  @Post('signup')
  signup(@Body() dto: AuthDto) {
    return this.authService.signup(dto);
  }

  /**Login */
  @HttpCode(HttpStatus.OK) //CUSTOM STATUS CODE
  @Post('signin')
  signin(@Body() dto: AuthDto) {
    return this.authService.login(dto);
  }

  /**
   * Social (Supabase OAuth) sign-in. The access token is verified by
   * SupabaseGuard, which attaches the Supabase user to the request; we then
   * find-or-create the local user and return our own JWT.
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseGuard)
  @Post('social')
  socialLogin(@Req() req: Request) {
    return this.authService.socialLogin(
      req.user as {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      },
    );
  }
}
