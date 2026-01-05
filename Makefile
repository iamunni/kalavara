.PHONY: help install dev build start lint clean setup db-reset env-check

# Default target
help:
	@echo "Kalavara - Personal Expense Tracker"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Setup:"
	@echo "  install      Install dependencies"
	@echo "  setup        First-time setup (install + env template + secret)"
	@echo "  env-check    Verify required environment variables"
	@echo ""
	@echo "Development:"
	@echo "  dev          Start development server"
	@echo "  build        Build for production"
	@echo "  start        Start production server"
	@echo "  lint         Run ESLint"
	@echo ""
	@echo "Database:"
	@echo "  db-reset     Reset database (delete and recreate)"
	@echo ""
	@echo "Utilities:"
	@echo "  clean        Remove build artifacts and node_modules"
	@echo "  secret       Generate a new NEXTAUTH_SECRET"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# First-time setup
setup: install
	@echo ""
	@if [ ! -f .env.local ]; then \
		echo "Creating .env.local from template..."; \
		cp .env.example .env.local; \
		echo ""; \
		echo "Generated NEXTAUTH_SECRET:"; \
		openssl rand -base64 32; \
		echo ""; \
		echo "Next steps:"; \
		echo "1. Edit .env.local with your Google OAuth credentials"; \
		echo "2. Add the generated NEXTAUTH_SECRET above to .env.local"; \
		echo "3. Run 'make dev' to start the development server"; \
	else \
		echo ".env.local already exists, skipping..."; \
	fi

# Check environment variables
env-check:
	@echo "Checking environment variables..."
	@if [ ! -f .env.local ]; then \
		echo "ERROR: .env.local not found. Run 'make setup' first."; \
		exit 1; \
	fi
	@grep -q "GOOGLE_CLIENT_ID=" .env.local && \
		grep -q "GOOGLE_CLIENT_SECRET=" .env.local && \
		grep -q "NEXTAUTH_SECRET=" .env.local && \
		echo "All required environment variables are set." || \
		echo "WARNING: Some environment variables may be missing."

# Start development server
dev: env-check
	@echo "Starting development server..."
	npm run dev

# Build for production
build: env-check
	@echo "Building for production..."
	npm run build

# Start production server
start: env-check
	@echo "Starting production server..."
	npm run start

# Run ESLint
lint:
	@echo "Running ESLint..."
	npm run lint

# Reset database
db-reset:
	@echo "Resetting database..."
	@if [ -f ./data/expense-tracker.db ]; then \
		rm -f ./data/expense-tracker.db; \
		rm -f ./data/expense-tracker.db-shm; \
		rm -f ./data/expense-tracker.db-wal; \
		echo "Database deleted."; \
	else \
		echo "No database found."; \
	fi
	@echo "Database will be recreated on next server start."

# Generate new NEXTAUTH_SECRET
secret:
	@echo "New NEXTAUTH_SECRET:"
	@openssl rand -base64 32

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf .next
	rm -rf node_modules
	rm -rf .turbo
	@echo "Clean complete. Run 'make install' to reinstall dependencies."
