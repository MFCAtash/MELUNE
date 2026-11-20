import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { SkipThrottle } from "@nestjs/throttler";
import { SongsService } from "./songs.service";
import { CreateSongDto } from "./dto/create-song.dto";
import { UpdateSongDto } from "./dto/update-song.dto";
import { SongQueryDto } from "./dto/song-query.dto";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";

@Controller("songs")
export class SongsController {
  constructor(private readonly songs: SongsService) {}

  // High-traffic public browse/read routes — exempt from the app-wide
  // throttle (write/admin routes below keep the default limit).
  @Public()
  @SkipThrottle()
  @Get()
  findAll(@Query() query: SongQueryDto) {
    return this.songs.findAll(query);
  }

  @Public()
  @SkipThrottle()
  @Get(":idOrSlug")
  findOne(@Param("idOrSlug") idOrSlug: string) {
    return this.songs.findOne(idOrSlug);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSongDto) {
    return user.role === Role.ADMIN
      ? this.songs.createByAdmin(dto)
      : this.songs.createForUser(user.id, dto);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSongDto,
  ) {
    return this.songs.update(id, user.id, user.role === Role.ADMIN, dto);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.songs.remove(id, user.id, user.role === Role.ADMIN);
  }
}
