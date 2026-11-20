import { Controller, Delete, Get, Post, Body, Query, HttpCode } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SearchService } from "./search.service";
import { SearchQueryDto } from "./dto/search-query.dto";
import { RecordSearchHistoryDto } from "./dto/record-search-history.dto";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * The one search endpoint, for both the Cmd+K palette (`type=all`, a
   * fixed-size preview per group) and the full `/search` page's tabs
   * (a specific type, normally paginated).
   *
   * Public — guests can search — but every keystroke fires a debounced
   * request from the frontend, so this route overrides the app-wide
   * default (ThrottlerGuard is registered globally in AppModule) with
   * its own tighter, shorter-window limit.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Get()
  async runSearch(@Query() query: SearchQueryDto) {
    if (query.type === "all") {
      return this.searchService.quickSearch(query.q);
    }
    if (query.type === "songs") return this.searchService.searchSongs(query.q, query.page, query.limit);
    if (query.type === "artists") return this.searchService.searchArtists(query.q, query.page, query.limit);
    if (query.type === "albums") return this.searchService.searchAlbums(query.q, query.page, query.limit);
    return this.searchService.searchPlaylists(query.q, query.page, query.limit);
  }

  /** Records one *committed* search (Enter / result click) — never called per keystroke. */
  @Post("history")
  @HttpCode(204)
  async recordHistory(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordSearchHistoryDto) {
    await this.searchService.recordHistory(user.id, dto.query);
  }

  @Get("history")
  async listHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.searchService.listHistory(user.id);
  }

  @Delete("history")
  @HttpCode(204)
  async clearHistory(@CurrentUser() user: AuthenticatedUser) {
    await this.searchService.clearHistory(user.id);
  }
}
