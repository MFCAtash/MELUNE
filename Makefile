# MELUNE — cross-platform command shortcuts.
# Run `make help` (GNU Make) or `task --list` (Taskfile).

.DEFAULT_GOAL := help
.PHONY: help install dev dev-web dev-api build lint typecheck test test-api test-web test-e2e db-generate db-migrate db-deploy lockfile-check docker-up docker-down cover

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies (npm ci)
	npm ci

dev: ## Run API and web in watch mode (two terminals)
	@echo "Run 'make dev-api' and 'make dev-web' in separate terminals"

dev-web: ## Start the Next.js dev server on :3000
	npm run dev:web

dev-api: ## Start the NestJS API in watch mode on :4000
	npm run dev:api

build: ## Build every workspace
	npm run build

lint: ## Lint every workspace
	npm run lint

typecheck: ## Type-check every workspace
	npm run typecheck

test: ## Run all unit tests
	npm run test

test-api: ## API unit tests with coverage
	npm run test:cov

test-web: ## Web unit tests (Vitest)
	npm run test --workspace=apps/web

test-e2e: ## API E2E tests (needs Postgres + Redis)
	npm run test:e2e

db-generate: ## Regenerate the Prisma client
	npm run prisma:generate

db-migrate: ## Apply migrations in development
	npm run prisma:migrate

db-deploy: ## Apply migrations in production/CI (forward only)
	npm run prisma:migrate:deploy

lockfile-check: ## Validate package-lock.json without network
	npm run lockfile:check

docker-up: ## Build and start the development Compose stack
	npm run docker:up

docker-down: ## Stop the development Compose stack
	npm run docker:down

cover: ## Open the API coverage report (after test-api)
	@echo "Open apps/api/coverage/lcov-report/index.html in your browser"
