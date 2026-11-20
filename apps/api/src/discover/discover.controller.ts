import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { DiscoverService } from "./discover.service";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";

@Controller("discover")
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  /**
   * Public so logged-out visitors still see Trending. Signed-in users get
   * Recently played + a genre-affinity "Made for you" mix on top — both
   * computed from real ListeningHistory rows, never mocked.
   *
   * High-traffic read path (hit on every homepage load) — exempt from
   * the app-wide throttle rather than sharing a budget with sensitive
   * routes like auth.
   */
  @Public()
  @SkipThrottle()
  @Get("home")
  getHome(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.discover.getHome(user?.id);
  }
}
