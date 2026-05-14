# ADR-010: WASM Backend Deferred

## Status

Accepted (deferred)

## Decision

A WASM-based local OpenFGA backend is deferred from v1. When implemented, it will be added as a second `BackendAdapter` implementation and will also enable a fully standalone hosted playground (no server dependency).

## Context

Running OpenFGA as a WASM binary in the browser would eliminate the `fga serve` dependency entirely, enabling:

- A fully hosted playground at `play.fga.dev` with no installation requirement
- Offline usage
- Simpler onboarding (no CLI to install)

## Rationale for deferral

- **Binary size**: Go WASM binaries are typically 10–20MB+. This is a significant page load penalty for the first visit. Techniques like TinyGo exist but have limitations for complex programs.
- **Design work**: The WASM backend requires careful thought about how to handle state persistence (in-memory only? IndexedDB?), how to integrate with `fga serve`'s existing profile management, and how to present the two modes to users.
- **Diminishing returns for target audience**: The v1 target audience is developers actively working with OpenFGA who likely have the CLI already. `fga serve` covers their use case well.
- **`BackendAdapter` interface**: The architecture already supports a WASM adapter. Adding it later requires only a new `WasmBackendAdapter` class; no interface changes needed.

## Future implementation notes

When implemented, the WASM backend adapter:

- Will implement `BackendAdapter` but with no profile CRUD (WASM runs a single in-memory server)
- `getClient()` will return an `OpenFgaClient` configured to talk to the WASM HTTP server (via a service worker or shared worker)
- The hosted playground will use WASM exclusively (no `fga serve` dependency)
- Local playground users can optionally switch to WASM mode for offline use

## Alternatives Not Taken Now

- **WASM in v1**: Scope risk. The foundation (components, core, shell, proxy) must be solid first.
- **Third-party WASM OpenFGA**: No mature option exists at time of writing.
