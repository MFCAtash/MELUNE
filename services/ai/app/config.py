from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    INITIAL SKELETON (see services/ai/README.md).

    codex_api_url points at the *existing* NestJS API's real
    content-based recommender (RecommendationsService /
    GET /api/recommendations/for-you) — there is no separate model or
    database this service owns yet, so there is nothing else to
    configure here.
    """

    codex_api_url: str = "http://localhost:4000/api"
    request_timeout_seconds: float = 5.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
