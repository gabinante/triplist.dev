# TripList — run `make` (or `make help`) for a list of targets.
# Fresh checkout? `make setup` then `make dev`.

SHELL := /bin/bash
NODE_MIN := 20
DB_CONTAINER := triplist-postgres
# Override with `make db-up DB_PORT=5432` if 5442 is taken; 5442 avoids clashing
# with other local Postgres instances on the default port.
DB_PORT := 5442
DB_URL := postgres://triplist:triplist@localhost:$(DB_PORT)/triplist

.DEFAULT_GOAL := help

.PHONY: help setup check-node install env dev build typecheck start clean db-up db-seed db-down deploy

help: ## Show available targets
	@echo "TripList targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-11s\033[0m %s\n", $$1, $$2}'

setup: check-node install env ## Set up from scratch: check Node, install deps, scaffold .env
	@echo "✔ Setup complete."
	@echo "  make dev    → dev server (no database needed; auth disabled)"
	@echo "  make db-up  → optional local Postgres if you want auth features"

check-node: ## Verify Node.js >= $(NODE_MIN) is installed
	@command -v node >/dev/null 2>&1 || { \
		echo "✖ Node.js not found. Install Node $(NODE_MIN)+ (https://nodejs.org or 'brew install node')."; \
		exit 1; }
	@major=$$(node -p 'process.versions.node.split(".")[0]'); \
	if [ "$$major" -lt $(NODE_MIN) ]; then \
		echo "✖ Node $$(node --version) found, but $(NODE_MIN)+ is required."; \
		exit 1; \
	fi
	@echo "✔ Node $$(node --version)"

install: ## Install npm dependencies (clean install from the lockfile)
	npm ci

env: ## Create .env from .env.example (never overwrites an existing .env)
	@if [ -f .env ]; then \
		echo "✔ .env already exists — leaving it alone"; \
	else \
		cp .env.example .env && echo "✔ Created .env from .env.example (all vars optional)"; \
	fi

dev: ## Start the Vite dev server
	npm run dev

build: ## Typecheck + production build (tsc -b && vite build)
	npm run build

typecheck: ## Typecheck only, no emit
	npx tsc --noEmit

start: build ## Build, then serve the production app (reads .env if present)
	node --env-file-if-exists=.env server/index.mjs

db-up: ## Start a local Postgres in Docker and seed the schema (for auth features; optional)
	@command -v docker >/dev/null 2>&1 || { \
		echo "✖ Docker not found — needed only for local Postgres. The app runs without it."; \
		exit 1; }
	@if [ "$$(docker ps -q -f name=^$(DB_CONTAINER)$$)" ]; then \
		echo "✔ $(DB_CONTAINER) already running"; \
	else \
		docker start $(DB_CONTAINER) 2>/dev/null || \
		docker run -d --name $(DB_CONTAINER) \
			-e POSTGRES_USER=triplist -e POSTGRES_PASSWORD=triplist -e POSTGRES_DB=triplist \
			-p $(DB_PORT):5432 postgres:17; \
	fi
	@echo -n "  waiting for Postgres"; \
	for i in $$(seq 1 30); do \
		docker exec $(DB_CONTAINER) pg_isready -U triplist -d triplist >/dev/null 2>&1 && break; \
		echo -n "."; sleep 1; \
	done; echo; \
	docker exec $(DB_CONTAINER) pg_isready -U triplist -d triplist >/dev/null 2>&1 || { \
		echo "✖ Postgres didn't become ready — check 'docker logs $(DB_CONTAINER)'"; exit 1; }
	@echo "✔ Postgres up."
	@$(MAKE) --no-print-directory db-seed
	@echo "  To enable auth, set in .env:"
	@echo "    DATABASE_URL=$(DB_URL)"
	@echo "    BETTER_AUTH_SECRET=$$(openssl rand -hex 32 2>/dev/null || echo '<openssl rand -hex 32>')"
	@echo "    BETTER_AUTH_URL=http://localhost:8080"

db-seed: ## Create the auth schema in the database (better-auth migrate; safe to re-run)
	@DATABASE_URL=$$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2-); \
	export DATABASE_URL=$${DATABASE_URL:-$(DB_URL)}; \
	echo "  seeding schema at $$DATABASE_URL"; \
	npx @better-auth/cli@latest migrate -y --config server/auth.mjs
	@echo "✔ Schema seeded (app tables like trip_share are created by the server on boot)."

db-down: ## Stop the local Postgres container
	@docker stop $(DB_CONTAINER) >/dev/null 2>&1 && echo "✔ Stopped $(DB_CONTAINER)" || echo "✔ $(DB_CONTAINER) not running"

clean: ## Remove build artifacts
	rm -rf dist tsconfig.tsbuildinfo

deploy: ## Manual deploy to Fly.io (merges to main auto-deploy via GitHub Actions)
	fly deploy --remote-only
