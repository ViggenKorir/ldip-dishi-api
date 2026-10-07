import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class modelDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  secondName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()  
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  county: string;

  @IsString()
  @IsNotEmpty()
  constituency: string;

  @IsString()
  @IsNotEmpty()
  ward: string;
}
