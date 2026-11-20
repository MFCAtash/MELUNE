import { Module } from "@nestjs/common";
import { DiscoverController } from "./discover.controller";
import { DiscoverService } from "./discover.service";
import { UserLibraryModule } from "../library/library.module";
import { RecommendationsModule } from "../recommendations/recommendations.module";

@Module({
  imports: [UserLibraryModule, RecommendationsModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
})
export class DiscoverModule {}
