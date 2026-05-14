# ADR-008: Backend Adapter Modes (Direct, Proxy, WASM)

## Status

Accepted

## Decision

Use three backend modes in this order:

1. `DirectBackendAdapter` (initial rollout): calls OpenFGA directly from the browser for unauthenticated or same-origin deployments.
2. `ProxyBackendAdapter` (fast-follow): routes through `fga serve` (`/servers/:id/proxy/*`), supports server management, stored credentials, and authenticated upstreams.
3. `WasmBackendAdapter` (later): browser-local runtime with no external server dependency (tracked in ADR-010).

Only direct is currently implemented. Proxy is planned as fast-follow and not yet complete. WASM is deferred and tracked separately (ADR-010).

## Context

The RFC defines multiple deployment surfaces and backend paths:

- Direct mode for environments where browser-to-server communication is acceptable
- Secure local proxy mode for multi-server and secrets-bearing workflows
- Future WASM mode for standalone hosted scenarios

The codebase currently ships direct adapter support; proxy is in progress as fast-follow.

A browser-based playground that connects to OpenFGA servers also has structural constraints:

1. **CORS**: Arbitrary OpenFGA servers may not allow browser origins like localhost playground URLs.
2. **Secret storage**: Credentials and tokens must not be persisted in browser storage.
3. **Shared configuration**: Developers need one reusable server configuration across CLI, playground, and IDE tooling.

## Rationale

- Matches RFC deployment goals without forcing a single runtime mode
- Enables simple local/dev usage first via direct mode
- Targets authenticated workflows via proxy mode in fast-follow (not yet complete)
- Preserves a stable `BackendAdapter` interface for future WASM and third-party adapters
- Uses `fga serve` as the intended secure proxy path for authenticated and multi-server workflows

Proxy-specific rationale:

- **CORS reduced**: proxy mode enables same-origin workflows (or controlled localhost CORS in dev).
- **Secrets off browser**: credentials are handled by `fga serve` and not re-exposed to the UI.
- **Shared config**: server definitions can be reused across CLI and other tools.

WASM-specific rationale:

- **No server dependency**: enables a fully standalone playground experience without requiring `fga serve` or a remote OpenFGA server.
- **Hosted experience**: supports future hosted usage (e.g. `play.openfga.dev`) where users can try playground features immediately in the browser.
- **Offline/local workflows**: allows model exploration and experimentation in disconnected or restricted environments.
- **Architectural fit**: reuses the same `BackendAdapter` contract, so WASM can be added without changing component interfaces.

## Trade-offs

- Direct mode cannot safely support client credentials or API tokens in-browser
- UX complexity increases slightly due to backend mode selection
- Tests must cover both runtime modes
- Proxy mode requires local `fga serve` availability for authenticated/multi-server usage
- WASM adds implementation and bundle-size complexity when introduced

## Notes

- Capability checks (`storeCrud`, `storeList`) still gate UI behavior regardless of adapter mode.
- Mode progression is intentional: Direct first, Proxy fast-follow, WASM later.

## Alternatives Considered

- **Direct browser-to-server only**: workable for unauthenticated/same-origin setups, but not for secrets-bearing workflows.
- **Hosted third-party proxy only**: centralizes auth but introduces trust and deployment constraints.
- **Browser extension proxy**: possible but increases install and support burden.
