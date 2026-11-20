"""
Codex Music — AI service — INITIAL SKELETON.

See services/ai/README.md for the honest, complete picture: this is a
placeholder microservice with two endpoints. `/recommend` does not run
any model — it forwards the caller's request straight to the existing
NestJS API's real content-based recommender
(`GET /api/recommendations/for-you`, see
apps/api/src/recommendations/recommendations.service.ts) and returns
whatever that endpoint returns.

The point of this skeleton is to reserve this service's *public
contract* (the routes, the request/response shape) so a real
collaborative-filtering model can be dropped in behind `/recommend`
later (Phase 8/9) without every caller needing to change. Nothing here
does feature engineering, training, or inference — there is no pandas,
numpy, scikit-learn, or PyTorch import in this codebase yet, despite
those being named as the eventual stack in the root README.
"""

from typing import Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel

from .config import settings

app = FastAPI(
    title="Codex Music AI service",
    description=(
        "INITIAL SKELETON — see services/ai/README.md. /recommend is a "
        "proxy to the NestJS API's existing recommender, not a model."
    ),
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str = "ok"
    mode: str = "skeleton"


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness check only — does not verify the upstream API is reachable."""
    return HealthResponse()


@app.get("/recommend")
async def recommend(
    limit: int = Query(default=20, ge=1, le=100),
    authorization: Optional[str] = Header(default=None),
):
    """
    Proxies straight to `GET {CODEX_API_URL}/recommendations/for-you`.

    That endpoint requires the same Bearer access token a logged-in web
    user would send — this service has no auth or user model of its
    own, so the caller's `Authorization` header is forwarded as-is and
    a missing one fails exactly the way the upstream API would.

    This is a deliberately thin, honest proxy — not a fallback, not a
    cache, not a mock response. If the upstream call fails, this
    endpoint fails too (502), rather than inventing a fake
    recommendation list.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    upstream_url = f"{settings.codex_api_url}/recommendations/for-you"

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        try:
            upstream_response = await client.get(
                upstream_url,
                params={"limit": limit},
                headers={"Authorization": authorization},
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Upstream recommendations API unreachable: {exc}",
            ) from exc

    if upstream_response.status_code >= 400:
        raise HTTPException(
            status_code=upstream_response.status_code,
            detail=upstream_response.text,
        )

    return upstream_response.json()
