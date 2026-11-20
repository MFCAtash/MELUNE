import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { CreateGenreDto } from "./dto/create-genre.dto";
import { UpdateGenreDto } from "./dto/update-genre.dto";

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.genre.findMany({ orderBy: { name: "asc" } });
  }

  async findOne(idOrSlug: string) {
    const genre = await this.prisma.genre.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!genre) throw new NotFoundException("Genre not found");
    return genre;
  }

  async create(dto: CreateGenreDto) {
    const existing = await this.prisma.genre.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException("Genre already exists");

    return this.prisma.genre.create({
      data: { name: dto.name, slug: slugify(dto.name) },
    });
  }

  async update(id: string, dto: UpdateGenreDto) {
    await this.findOne(id);
    return this.prisma.genre.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.name ? { slug: slugify(dto.name) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.genre.delete({ where: { id } });
  }
}
