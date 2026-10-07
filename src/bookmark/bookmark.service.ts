import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { BookmarkDto,  BookmarkPatchDto } from 'src/common/dto';
import { bookmarkSelect } from 'src/common/helpers/modelSelect';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BookmarkService {
  constructor(private prisma: PrismaService) {}

  /**Centralized error handler */
  private handlePrismaError(error: any) {
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': //UNIQUE CONSTRAINT VIOLATION
          throw new ForbiddenException(
            `A record with these details already exists.`,
          );
        case 'P2003': //FOREIGN KEY CONSTRAINT FAILED
          if (error.meta?.field_name) {
            const fieldName = error.meta.field_name as string;
            const modelName = fieldName.split('_')[0];
            throw new ConflictException(
              `Cannot delete. This record is still in use by '${modelName}'.`,
            );
          }
          throw new ConflictException(
            'This record cannot be deleted because it is still in use by other records.',
          );
        case 'P2025': //RECORD TO UPDATE/DELETE NOT FOUND
          throw new NotFoundException('The requested record was not found.');
        default:
          console.error('Unhandled Prisma Error:', error);
          break;
      }
    }
    /**For unknown errors throw generic server error */
    throw new InternalServerErrorException(
      error.message || 'An unexpected error occurred',
    );
  }

  /** API CRUD */

  /**Get all bookmarks */
  async getAllBookmarks() {
    /** Get all bookmarks from db */
    try {
      const bookmarks = await this.prisma.bookmark.findMany({
        select: bookmarkSelect,
      });
      return bookmarks;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

    /**Get a specified bookmark by Id */
    async findBookmarkById(bookmarkId: string) {
      /** save the new bookmark in the db */
      try {
        const bookmark = await this.prisma.bookmark.findUniqueOrThrow({
          where: {
            id: bookmarkId,
          },
          select: bookmarkSelect,
        });

        /** return the found bookmark */
        return bookmark;
      } catch (error) {
        /**Handle any errors */
      this.handlePrismaError(error);
      }
    }

    /**Create a new bookmark */
    async createBookmark(dto: BookmarkDto) {
      /**save the new bookmark in the db*/
      try {
        const bookmark = await this.prisma.bookmark.create({
          data: {
            title: dto. title,
            description: dto.description,
            link: dto.link,
            userId: dto.userId,           
          },
          select: bookmarkSelect,
        });

        /**return the saved bookmark*/
        return bookmark;
      } catch (error) {
        /**Handle any errors */
        this.handlePrismaError(error);
      }
    }

    /**Patch a bookmark */
    async patchBookmark(bookmarkId: string, dto: BookmarkPatchDto) {
      try {
        /**Find bookmark patch and automatically throw errors */
        const bookmark = await this.prisma.bookmark.update({
          where: { id: bookmarkId },
          data: dto,
          select: bookmarkSelect,
        });

        return bookmark;
      } catch (error) {
        /**Handle any errors */
        this.handlePrismaError(error);
      }
    }

    /**Delete a bookmark */
    async deleteBookmark(bookmarkId: string) {
      /** Delete specified bookmark from db */
      try {
        const bookmark = await this.prisma.bookmark.delete({
          where: { id: bookmarkId },
          select: bookmarkSelect,
        });
        return bookmark;
      } catch (error) {
        /**Handle any errors */
        this.handlePrismaError(error);
      }
    }

  /** SPECIALIZED SERVICES */
}
