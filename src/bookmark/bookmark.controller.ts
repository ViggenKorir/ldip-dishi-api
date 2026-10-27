import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookmarkService } from './bookmark.service';
import { BookmarkDto, BookmarkPatchDto } from 'src/common/dto';

/**
 * Starter scaffolding, not Dishi domain. Deprecated in the catalog; kept
 * running only because old demos call it. No new callers.
 */
@ApiTags('deprecated')
@Controller('bookmarks')
export class BookmarkController {
  constructor(private bookmarkService: BookmarkService) {}

  @Get()
  @ApiOperation({ summary: 'DEPRECATED scaffold: list bookmarks' })
  GetAllBookmarks() {
    return this.bookmarkService.getAllBookmarks();
  }

  @Get(':id')
  @ApiOperation({ summary: 'DEPRECATED scaffold: bookmark by id' })
  getBookmarkById(@Param() params: any) {
    const bookmarkId = params.id;
    return this.bookmarkService.findBookmarkById(bookmarkId);
  }

  @Post()
  @ApiOperation({ summary: 'DEPRECATED scaffold: create bookmark' })
  // @UseGuards(SupabaseGuard, RolesGuard) //apply guards, start with authguard
  createBookmark(@Body() dto: BookmarkDto) {
    return this.bookmarkService.createBookmark(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'DEPRECATED scaffold: patch bookmark' })
  // @UseGuards(SupabaseGuard)
  patchBookmark(@Param() params: any, @Body() dto: BookmarkPatchDto) {
    const bookmarkId = params.id;
    return this.bookmarkService.patchBookmark(bookmarkId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'DEPRECATED scaffold: delete bookmark' })
  // @UseGuards(SupabaseGuard)
  deleteBookmark(@Param() params: any) {
    const bookmarkId = params.id;
    return this.bookmarkService.deleteBookmark(bookmarkId);
  }
}
