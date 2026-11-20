import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { Paginated } from "../../common/dto/pagination-query.dto";
import { CreateSongDto } from "./dto/create-song.dto";
import { UpdateSongDto } from "./dto/update-song.dto";
import { SongQueryDto } from "./dto/song-query.dto";
import { ArtistsService } from "../artists/artists.service";
import { CacheService } from "../../redis/cache.service";
import { StorageService } from "../../storage/storage.service";
import { NotificationsService } from "../../notifications/notifications.service";

const SONGS_CACHE_PREFIX = "songs:list:";

@Injectable()
export class SongsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artists: ArtistsService,
    private readonly cache: CacheService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: SongQueryDto): Promise<Paginated<unknown>> {
    // Read-through cache: song lists are read far more often than they
    // change, and every anonymous browse hits this endpoint, so caching
    // it is the single highest-value use of Redis in the catalog. Keyed
    // on every filter/pagination param so different queries never collide.
    const cacheKey = `${SONGS_CACHE_PREFIX}${query.page}:${query.limit}:${query.artistId ?? "-"}:${query.albumId ?? "-"}:${query.genreId ?? "-"}`;

    return this.cache.getOrSet(cacheKey, 60, async () => {
      const where = {
        deletedAt: null,
        ...(query.artistId ? { artistId: query.artistId } : {}),
        ...(query.albumId ? { albumId: query.albumId } : {}),
        ...(query.genreId ? { genreId: query.genreId } : {}),
      };

      const [items, total] = await this.prisma.$transaction([
        this.prisma.song.findMany({
          where,
          skip: query.skip,
          take: query.limit,
          orderBy: { createdAt: "desc" },
          include: {
            artist: { select: { id: true, name: true, slug: true } },
            album: { select: { id: true, title: true, slug: true, coverUrl: true } },
            genre: { select: { id: true, name: true, slug: true } },
          },
        }),
        this.prisma.song.count({ where }),
      ]);

      return {
        items,
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    });
  }

  async findOne(idOrSlug: string) {
    const song = await this.prisma.song.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
      include: {
        artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
        album: { select: { id: true, title: true, slug: true, coverUrl: true } },
        genre: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!song) throw new NotFoundException("Song not found");
    return song;
  }

  async createForUser(userId: string, dto: CreateSongDto) {
    const artist = await this.artists.findByUserId(userId);
    if (!artist) throw new NotFoundException("Artist profile not found");

    return this.createRecord(artist.id, dto);
  }

  /** Admin-only path — creates a song under any artist, chosen explicitly
   *  via `dto.artistId` rather than resolved from the caller's own profile. */
  async createByAdmin(dto: CreateSongDto) {
    if (!dto.artistId) {
      throw new BadRequestException("artistId is required when creating as an admin");
    }
    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist || artist.deletedAt) {
      throw new BadRequestException("artistId does not exist");
    }

    return this.createRecord(artist.id, dto);
  }

  private async createRecord(artistId: string, dto: CreateSongDto) {
    await this.assertAlbumBelongsToArtist(dto.albumId, artistId);
    await this.assertGenreExists(dto.genreId);

    const artist = await this.prisma.artist.findUniqueOrThrow({ where: { id: artistId } });

    const song = await this.prisma.song.create({
      data: {
        title: dto.title,
        slug: await this.uniqueSlug(dto.title),
        artistId,
        albumId: dto.albumId,
        genreId: dto.genreId,
        duration: dto.duration,
        audioUrl: dto.audioUrl,
        coverUrl: dto.coverUrl,
        bpm: dto.bpm,
        mood: dto.mood,
        energy: dto.energy,
      },
    });

    await this.cache.delByPrefix(SONGS_CACHE_PREFIX);
    await this.notifications.notifyNewRelease(artist.id, artist.name, song.id, song.title);
    await this.queueTranscodeIfPossible(song.id, song.audioUrl);

    return song;
  }

  async update(id: string, userId: string, isAdmin: boolean, dto: UpdateSongDto) {
    const song = await this.getOwnedOrThrow(id, userId, isAdmin);

    // Reassigning a song to a different artist isn't a supported update —
    // artistId on the DTO only means something on *create* (admin path).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { artistId: _ignored, ...safeDto } = dto;

    if (safeDto.albumId !== undefined) {
      await this.assertAlbumBelongsToArtist(safeDto.albumId, song.artistId);
    }
    if (safeDto.genreId !== undefined) {
      await this.assertGenreExists(safeDto.genreId);
    }

    const updated = await this.prisma.song.update({
      where: { id: song.id },
      data: {
        ...safeDto,
        ...(safeDto.title ? { slug: await this.uniqueSlug(safeDto.title, song.id) } : {}),
      },
    });

    await this.cache.delByPrefix(SONGS_CACHE_PREFIX);
    await this.cleanupReplacedFile(song.audioUrl, safeDto.audioUrl);
    await this.cleanupReplacedFile(song.coverUrl, safeDto.coverUrl);

    // Re-audio was replaced — the old hlsPlaylistUrl (if any) belongs to
    // the previous file, so re-transcode. No need to null it out first:
    // the worker overwrites `hlsPlaylistUrl` only once the new job
    // finishes, and PlayerEngine falls back to `audioUrl` in the
    // meantime regardless of which file the stale playlist pointed to.
    if (safeDto.audioUrl && safeDto.audioUrl !== song.audioUrl) {
      await this.queueTranscodeIfPossible(updated.id, updated.audioUrl);
    }

    return updated;
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const song = await this.getOwnedOrThrow(id, userId, isAdmin);
    await this.prisma.song.update({
      where: { id: song.id },
      data: { deletedAt: new Date() },
    });
    await this.cache.delByPrefix(SONGS_CACHE_PREFIX);
  }

  /** Enqueues the async HLS transcode job for a song's audio, when that
   *  audio actually lives in our own bucket (an externally-linked
   *  `audioUrl` has no bucket key, so there's nothing to fetch/transcode
   *  from — the song just keeps playing straight from that URL). */
  private async queueTranscodeIfPossible(songId: string, audioUrl: string): Promise<void> {
    const sourceKey = this.storage.keyFromPublicUrl(audioUrl);
    if (sourceKey) {
      await this.storage.transcodeAudio(songId, sourceKey);
    }
  }

  /** Deletes the old bucket object when a URL field is replaced with a new one (no-op for external links). */
  private async cleanupReplacedFile(oldUrl: string | null | undefined, newUrl: string | null | undefined) {
    if (!oldUrl || newUrl === undefined || newUrl === oldUrl) return;
    const key = this.storage.keyFromPublicUrl(oldUrl);
    if (key) await this.storage.deleteObject(key);
  }

  private async getOwnedOrThrow(id: string, userId: string, isAdmin: boolean) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: { artist: true },
    });
    if (!song || song.deletedAt) throw new NotFoundException("Song not found");

    this.artists.assertOwnership(song.artist.userId, userId, isAdmin);
    return song;
  }

  private async assertAlbumBelongsToArtist(albumId: string | undefined, artistId: string) {
    if (!albumId) return;
    const album = await this.prisma.album.findUnique({ where: { id: albumId } });
    if (!album || album.deletedAt || album.artistId !== artistId) {
      throw new BadRequestException("albumId must belong to your own artist profile");
    }
  }

  private async assertGenreExists(genreId: string | undefined) {
    if (!genreId) return;
    const genre = await this.prisma.genre.findUnique({ where: { id: genreId } });
    if (!genre) {
      throw new BadRequestException("genreId does not exist");
    }
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;

    while (
      await this.prisma.song.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${base}-${++suffix}`;
    }

    return candidate;
  }
}
