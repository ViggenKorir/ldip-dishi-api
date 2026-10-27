import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AuthDto {
  @ApiProperty({ example: 'wanjiru@example.co.ke' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 's3cret-passphrase', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: 'Wanjiru' })
  @IsOptional()
  @IsString()
  firstName?: string;
}
