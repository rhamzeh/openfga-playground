.PHONY: install build build-core build-components build-playground dev test test-core test-components test-e2e lint typecheck clean ci

install:
	pnpm install

build:
	pnpm -r run build

build-core:
	pnpm --filter @openfga/playground-core run build

build-components:
	pnpm --filter @openfga/playground-components run build

build-playground:
	pnpm --filter @openfga/playground run build

dev:
	pnpm --filter @openfga/playground run dev

test:
	pnpm -r run test

test-core:
	pnpm --filter @openfga/playground-core run test

test-components:
	pnpm --filter @openfga/playground-components run test

test-e2e:
	pnpm exec playwright test

lint:
	pnpm -r run lint

typecheck:
	pnpm -r run typecheck

clean:
	pnpm -r run clean

ci: typecheck lint build test
