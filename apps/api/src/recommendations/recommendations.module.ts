import { Module } from "@nestjs/common";
import { RecommendationsController } from "./recommendations.controller";
import { RecommendationsService } from "./recommendations.service";
import { CollaborativeService } from "./collaborative.service";
import { HybridRecommendationsService } from "./hybrid-recommendations.service";

@Module({
  controllers: [RecommendationsController],
  // RecommendationsService (content-based) and CollaborativeService run as
  // independent, parallel providers — HybridRecommendationsService is the
  // only thing that depends on both, so neither engine ever needs to know
  // the other exists.
  providers: [RecommendationsService, CollaborativeService, HybridRecommendationsService],
  // RecommendationsService stays exported too: the /recommendations/for-you
  // endpoint on this module's own controller intentionally still serves the
  // raw content-based mix, unchanged by Phase 9.
  exports: [RecommendationsService, HybridRecommendationsService],
})
export class RecommendationsModule {}
