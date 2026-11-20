import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PlaylistsService } from "./playlists.service";
import { CreatePlaylistDto } from "./dto/create-playlist.dto";
import { UpdatePlaylistDto } from "./dto/update-playlist.dto";
import { AddPlaylistSongDto } from "./dto/add-playlist-song.dto";
import { ReorderPlaylistDto } from "./dto/reorder-playlist.dto";
import { Public } from "../../auth/decorators/public.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

@Controller("playlists")
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Public()
  @Get()
  findPublic(@Query() query: PaginationQueryDto) {
    return this.playlists.findPublic(query);
  }

  @Get("me")
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.playlists.findMine(user.id, query);
  }

  @Public()
  @Get(":idOrSlug")
  findOne(
    @Param("idOrSlug") idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.playlists.findOne(idOrSlug, user?.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlaylistDto) {
    return this.playlists.create(user.id, dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlists.update(id, user.id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.playlists.remove(id, user.id);
  }

  @Post(":id/songs")
  addSong(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPlaylistSongDto,
  ) {
    return this.playlists.addSong(id, user.id, dto.songId);
  }

  @Delete(":id/songs/:songId")
  @HttpCode(204)
  removeSong(
    @Param("id") id: string,
    @Param("songId") songId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.playlists.removeSong(id, user.id, songId);
  }

  @Patch(":id/songs/reorder")
  reorder(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderPlaylistDto,
  ) {
    return this.playlists.reorder(id, user.id, dto.songIds);
  }
}
