import { PartialType } from '@nestjs/swagger';
import { BookmarkDto } from './bookmark.dto';

export class BookmarkPatchDto extends PartialType(BookmarkDto) {}