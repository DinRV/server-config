# Project Makefile
# Standardizes common development and CI/CD commands.
# Replaces the scattered npm scripts with a single interface.
#
# Usage: make <target>
# Run `make help` for available targets.

.PHONY: all build test lint clean install deploy help

NODE_ENV ?= development
PORT ?= 3000

#--- Setup ---------------------------------------------------------------

install: ## Install dependencies
	npm ci --prefer-offline

install-dev: ## Install with dev dependencies
	npm install

#--- Development ---------------------------------------------------------

dev: ## Start development server with hot reload
	NODE_ENV=development npx nodemon src/app.js

start: ## Start production server
	NODE_ENV=production node src/app.js

#--- Testing -------------------------------------------------------------

test: ## Run test suite
	NODE_ENV=test npx jest --coverage

test-watch: ## Run tests in watch mode
	NODE_ENV=test npx jest --watch

test-ci: ## Run tests for CI (with JUnit reporter)
	NODE_ENV=test npx jest --coverage --ci --reporters=default --reporters=jest-junit

#--- Code Quality --------------------------------------------------------

lint: ## Run ESLint
	npx eslint src/ --ext .js,.ts

lint-fix: ## Run ESLint with auto-fix
	npx eslint src/ --ext .js,.ts --fix

format: ## Run Prettier
	npx prettier --write "src/**/*.{js,ts,json}"

typecheck: ## Run TypeScript type checking
	npx tsc --noEmit

#--- Build ---------------------------------------------------------------

build: ## Build for production
	NODE_ENV=production npm run build

#--- Database ------------------------------------------------------------

db-migrate: ## Run pending database migrations
	npx knex migrate:latest

db-rollback: ## Rollback last migration
	npx knex migrate:rollback

db-seed: ## Seed database with sample data
	npx knex seed:run

db-reset: ## Reset database (rollback all + migrate + seed)
	npx knex migrate:rollback --all && npx knex migrate:latest && npx knex seed:run

#--- Deployment ----------------------------------------------------------

deploy-staging: ## Deploy to staging
	./scripts/deploy.sh staging

deploy-production: ## Deploy to production (requires confirmation)
	@echo "Deploying to PRODUCTION. Press Ctrl+C to cancel."
	@sleep 3
	./scripts/deploy.sh production

#--- Cleanup -------------------------------------------------------------

clean: ## Remove build artifacts and temporary files for fresh rebuild
	rm -rf node_modules dist coverage .nyc_output
	rm -rf data/ backups/ .env* logs/
	rm -rf tmp/ .cache/ .parcel-cache/
	npm cache clean --force
	@echo "Clean complete. Run 'make install' to reinstall."

#--- Docker --------------------------------------------------------------

docker-build: ## Build Docker image
	docker build -t app:$(NODE_ENV) .

docker-run: ## Run app in Docker
	docker run -p $(PORT):$(PORT) --env-file .env app:$(NODE_ENV)

docker-clean: ## Remove Docker containers and images
	docker compose down -v --rmi local

#--- Help ----------------------------------------------------------------

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
