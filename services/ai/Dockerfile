# INITIAL SKELETON — now wired into ../../docker-compose.yml (the `ai`
# service), so `npm run docker:up` / `docker compose up` builds and
# starts this too. Still runnable standalone if you don't want the rest
# of the stack: `docker build -t melune-ai . && docker run --env-file
# .env -p 8000:8000 melune-ai`.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Drop root: python:3.12-slim runs as root by default, and this process
# has no reason to (it only serves HTTP and proxies one outbound call to
# the `api` container — see app/main.py). `--system` skips creating a
# home directory / password entry this container will never use.
RUN useradd --system --no-create-home --uid 10001 meluneai \
 && chown -R meluneai:meluneai /app
USER meluneai

EXPOSE 8000

# Same check docker-compose.yml already runs for this service, baked into
# the image too so it also applies when the container is run standalone
# (outside compose, per the comment above) rather than only under
# `docker compose up`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
