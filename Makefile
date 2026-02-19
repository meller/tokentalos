.PHONY: all setup build dev start clean help

all: setup help

setup:
	npm run setup
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "To start development:"
	@echo "  make dev          - Starts API (5060) and Dashboard (5062) in watch mode"
	@echo ""
	@echo "To build and run production:"
	@echo "  make build        - Builds the dashboard and bundles it into the API"
	@echo "  make start        - Starts the unified service on port 5060"
	@echo ""
	@echo "Or simply use:"
	@echo "  npx .             - Run as a standalone utility"
	@echo ""

build:
	npm run build

dev:
	npm run dev:api & npm run dev:dashboard

start:
	npm start

clean:
	rm -rf api/public/*
	rm -rf dashboard/dist

help:
	@echo "TokenTalos Commands:"
	@echo "  make setup        - Install all dependencies"
	@echo "  make build        - Build dashboard and bundle into API"
	@echo "  make dev          - Run API and Dashboard in development mode"
	@echo "  make start        - Run the production unified service"
	@echo "  make clean        - Remove build artifacts"
