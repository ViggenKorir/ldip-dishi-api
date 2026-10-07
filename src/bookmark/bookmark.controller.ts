import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { BookmarkDto, BookmarkPatchDto } from 'src/common/dto';

@Controller('bookmarks')
export class BookmarkController {
  constructor(private bookmarkService: BookmarkService) {}

  @Get()
  GetAllBookmarks() {
    return this.bookmarkService.getAllBookmarks();
  }

  @Get(':id')
  getBookmarkById(@Param() params: any) {
    const bookmarkId = params.id;
    return this.bookmarkService.findBookmarkById(bookmarkId);
  }

  @Post()
  // @UseGuards(SupabaseGuard, RolesGuard) //apply guards, start with authguard
  createBookmark(@Body() dto: BookmarkDto) {
    return this.bookmarkService.createBookmark(dto);
  }

  @Patch(':id')
  // @UseGuards(SupabaseGuard)
  patchBookmark(@Param() params: any, @Body() dto: BookmarkPatchDto) {
    const bookmarkId = params.id;
    return this.bookmarkService.patchBookmark(bookmarkId, dto);
  }

  @Delete(':id')
  // @UseGuards(SupabaseGuard)
  deleteBookmark(@Param() params: any) {
    const bookmarkId = params.id;
    return this.bookmarkService.deleteBookmark(bookmarkId);
  }
}
