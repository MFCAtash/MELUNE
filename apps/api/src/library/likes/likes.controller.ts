import { Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { LikesService } from "./likes.service";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

@Controller()
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  @Get("me/likes")
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.likes.findMine(user.id, query);
  }

  @Post("songs/:songId/like")
  @HttpCode(204)
  like(@Param("songId") songId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.likes.like(user.id, songId);
  }

  @Delete("songs/:songId/like")
  @HttpCode(204)
  unlike(@Param("songId") songId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.likes.unlike(user.id, songId);
  }
}
