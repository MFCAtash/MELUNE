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
import { ArtistsService } from "./artists.service";
import { CreateArtistDto } from "./dto/create-artist.dto";
import { UpdateArtistDto } from "./dto/update-artist.dto";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

@Controller("artists")
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Public()
  @SkipThrottle()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.artists.findAll(query);
  }

  @Public()
  @SkipThrottle()
  @Get(":idOrSlug")
  findOne(@Param("idOrSlug") idOrSlug: string) {
    return this.artists.findOne(idOrSlug);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Post()
  createOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateArtistDto,
  ) {
    return user.role === Role.ADMIN
      ? this.artists.createByAdmin(dto)
      : this.artists.createForUser(user.id, dto);
  }

  @Roles(Role.ARTIST)
  @Patch("me")
  updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateArtistDto,
  ) {
    return this.artists.updateOwn(user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  updateById(@Param("id") id: string, @Body() dto: UpdateArtistDto) {
    return this.artists.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.artists.remove(id);
  }
}
