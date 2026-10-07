import { PartialType } from '@nestjs/mapped-types';
import { BookmarkDto } from './bookmark.dto';

export class BookmarkPatchDto extends PartialType(BookmarkDto) {}