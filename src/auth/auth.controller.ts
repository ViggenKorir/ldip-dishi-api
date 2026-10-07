import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './auth-dto';

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
}
