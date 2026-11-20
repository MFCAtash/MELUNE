# MELUNE AI service (skeleton)

A deliberately small FastAPI microservice that reserves the **public contract** for
future machine-learning features without pretending to run a model today.

> Read this first: this service is an *initial skeleton*. It has two routes and
> `/recommend` proxies to the existing NestJS recommender. There is no training,
> inference or feature engineering in this codebase yet.

## Routes

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/health` | Liveness only (`{"status":"ok","mode":"skeleton"}`). Does **not** check upstream reachability. |
| `GET` | `/recommend?limit=1..100` | Forwards the caller's `Authorization` header to `GET {MELUNE_API_URL}/recommendations/for-you` and returns that response unchanged. |

The idea: callers are written against these routes now, so a real
collaborative-filtering model can be dropped behind `/recommend` later without
every client changing.

## Why it exists

Phase 8/9 planned collaborative filtering for recommendations. Rather than
blocking the API design on a model, the contract was frozen first. The NestJS side
already implements hybrid content + collaborative scoring in
`apps/api/src/recommendations/recommendations.service.ts`.

## Configuration

Copy `.env.example` → `.env`:

```
MELUNE_API_URL=http://localhost:4000/api
REQUEST_TIMEOUT_SECONDS=5.0
```

Secrets belong in `.env` (gitignored), never in code or image build args.

## Running locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Docker (also included in `docker-compose.yml` as the `ai` service):

```bash
docker compose --env-file ../../.env -f ../../docker-compose.yml up ai
```

## Dependencies

Only what the two routes need: `fastapi`, `uvicorn[standard]`, `httpx`,
`pydantic-settings`. `requirements.txt` is intentionally free of pandas, numpy,
scikit-learn or PyTorch until a model actually ships.

## Tests

```bash
pytest tests/          # health + proxy contract
```

## What would make this real

1. A feature store / interaction table fed by listening events.
2. Offline training job producing embeddings or a factorisation model.
3. Model serving behind `/recommend` with the same request/response shape.
4. Cache invalidation when a user's taste profile changes materially.

See [docs/ai.md](../../docs/ai.md) for the design discussion.
