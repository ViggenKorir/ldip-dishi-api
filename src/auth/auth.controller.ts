import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthDto } from './auth-dto';
import { SupabaseGuard } from './guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**Signup */
  @ApiOperation({
    summary: 'Create an email/password account (legacy path)',
    description:
      'Superseded at pilot by Supabase-managed sign-up; kept for the running app.',
  })
  @Post('signup')
  signup(@Body() dto: AuthDto) {
    return this.authService.signup(dto);
  }

  /**Login */
  @HttpCode(HttpStatus.OK) //CUSTOM STATUS CODE
  @ApiOperation({ summary: 'Exchange credentials for a Nest JWT (15 min)' })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Exchange a verified Supabase token for a Nest JWT',
    description:
      'Send Authorization: Bearer <supabase access token>. 403 with a plain body if the token is invalid.',
  })
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
