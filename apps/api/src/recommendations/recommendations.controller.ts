import { Controller, Get, Query } from "@nestjs/common";
import { RecommendationsService } from "./recommendations.service";
import { ForYouQueryDto } from "./dto/for-you-query.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";

@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  /**
   * Content-based "For You" mix (Phase 8.2). Requires auth — unlike
   * `GET /discover/home`, there's no meaningful anonymous version of
   * this endpoint, so it isn't `@Public()`.
   */
  @Get("for-you")
  async forYou(@CurrentUser() user: AuthenticatedUser, @Query() query: ForYouQueryDto) {
    const { scored, basis } = await this.recommendations.getForYou(user.id, query.limit);
    const songs = await this.recommendations.hydrate(scored);

    const byId = new Map(songs.map((s) => [s.id, s]));
    const items = scored
      .map((s) => {
        const song = byId.get(s.songId);
        return song ? { song, score: Math.round(s.score * 1000) / 1000 } : null;
      })
      .filter((i): i is NonNullable<typeof i> => Boolean(i));

    return { items, basis };
  }
}
