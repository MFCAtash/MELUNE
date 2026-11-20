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
import { AlbumsService } from "./albums.service";
import { CreateAlbumDto } from "./dto/create-album.dto";
import { UpdateAlbumDto } from "./dto/update-album.dto";
import { AlbumQueryDto } from "./dto/album-query.dto";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";

@Controller("albums")
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Public()
  @SkipThrottle()
  @Get()
  findAll(@Query() query: AlbumQueryDto) {
    return this.albums.findAll(query);
  }

  @Public()
  @SkipThrottle()
  @Get(":idOrSlug")
  findOne(@Param("idOrSlug") idOrSlug: string) {
    return this.albums.findOne(idOrSlug);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlbumDto) {
    return user.role === Role.ADMIN
      ? this.albums.createByAdmin(dto)
      : this.albums.createForUser(user.id, dto);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlbumDto,
  ) {
    return this.albums.update(id, user.id, user.role === Role.ADMIN, dto);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.albums.remove(id, user.id, user.role === Role.ADMIN);
  }
}
