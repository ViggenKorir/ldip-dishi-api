import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class BookmarkDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  @IsUrl()
  link: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}
