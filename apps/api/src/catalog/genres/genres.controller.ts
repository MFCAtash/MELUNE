import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { GenresService } from "./genres.service";
import { CreateGenreDto } from "./dto/create-genre.dto";
import { UpdateGenreDto } from "./dto/update-genre.dto";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("genres")
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Public()
  @SkipThrottle()
  @Get()
  findAll() {
    return this.genres.findAll();
  }

  @Public()
  @SkipThrottle()
  @Get(":idOrSlug")
  findOne(@Param("idOrSlug") idOrSlug: string) {
    return this.genres.findOne(idOrSlug);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateGenreDto) {
    return this.genres.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateGenreDto) {
    return this.genres.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.genres.remove(id);
  }
}
