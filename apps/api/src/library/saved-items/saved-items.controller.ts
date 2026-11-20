import { Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { IsIn, IsOptional } from "class-validator";
import { SavedItemsService } from "./saved-items.service";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

class LibraryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["album", "artist", "playlist"])
  type?: "album" | "artist" | "playlist";
}

@Controller("me/library")
export class SavedItemsController {
  constructor(private readonly library: SavedItemsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: LibraryQueryDto) {
    return this.library.findMine(user.id, query.type, query);
  }

  @Post("albums/:id")
  @HttpCode(204)
  saveAlbum(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.library.save(user.id, "album", id);
  }

  @Delete("albums/:id")
  @HttpCode(204)
  unsaveAlbum(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.library.unsave(user.id, "album", id);
  }

  @Post("artists/:id")
  @HttpCode(204)
  saveArtist(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.library.save(user.id, "artist", id);
  }

  @Delete("artists/:id")
  @HttpCode(204)
  unsaveArtist(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.library.unsave(user.id, "artist", id);
  }

  @Post("playlists/:id")
  @HttpCode(204)
  savePlaylist(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.library.save(user.id, "playlist", id);
  }

  @Delete("playlists/:id")
  @HttpCode(204)
  unsavePlaylist(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.library.unsave(user.id, "playlist", id);
  }
}
