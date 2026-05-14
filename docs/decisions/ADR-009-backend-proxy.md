# ADR-009: Proxy Architecture via `fga serve`

## Status

Accepted

## Decision

Proxy mode is implemented through `fga serve` as the architecture boundary between the browser playground and upstream OpenFGA servers.

The proxy architecture includes:

- server management APIs under `/servers`
- transparent OpenFGA forwarding under `/servers/:id/proxy/*`
- SDK client configuration pointing to proxy `apiUrl`
- server-centric local config in `$XDG_CONFIG_HOME/fga/servers.yaml`
- capability-aware frontend behavior and immediate write semantics through the adapter contract

## Context

The architecture supports multiple backend modes, but secure authenticated and multi-server usage requires a proxy boundary for CORS control, credential handling, and reusable configuration.

Proxy mode is intended to solve problems that direct browser mode cannot fully solve:

1. **CORS and origin constraints** for browser-to-arbitrary OpenFGA servers
2. **Credential handling** for client credentials and access tokens
3. **Cross-tool configuration reuse** between CLI, playground, and IDE integrations

This ADR records the proxy architecture itself. Rollout timing (direct first, proxy fast-follow) is tracked as planning context, not the core decision of this ADR.

## Proxy Design Decisions

### Runtime and ownership

- Proxy runtime lives in the `openfga/cli` repository as `fga serve`.
- Playground does not implement custom OpenFGA HTTP logic; it routes through SDK client configuration.

### API shape

- Server management endpoints are exposed under `/servers`.
- OpenFGA API traffic is proxied through `/servers/:id/proxy/*`.
- Playground SDK client is configured with `apiUrl` like `http://localhost:8880/servers/:id/proxy`.

### Configuration model

- Connection definitions are stored in `$XDG_CONFIG_HOME/fga/servers.yaml`.
- Config includes server metadata and capabilities used for UI gating.
- Naming is `servers` (not profiles) across CLI and playground.

### Security model

- Secrets are managed by `fga serve`; the browser never reads them back.
- Proxy is localhost-oriented and validated for safe local usage.
- Origin checks and token/session controls are used in proxy mode to reduce cross-origin abuse risk.

### Frontend integration behavior

- Proxy mode is capability-aware (`storeCrud`, `storeList`) and must not call gated methods when unsupported.
- Write semantics remain immediate (model writes, tuple writes, checks) once proxy mode is active.
- Adapter boundary remains stable via `BackendAdapter`, preserving extensibility for WASM/third-party adapters.

## Rationale

- Establishes a secure integration boundary for authenticated and multi-server workflows
- Keeps browser code free of custom proxy/auth plumbing by reusing SDK + proxy URL configuration
- Centralizes connection metadata and capability policy in one config model (`servers.yaml`)
- Aligns CLI, playground, and future IDE tooling on one backend contract (`/servers` + `/servers/:id/proxy/*`)
- Avoids re-litigating endpoint shape and responsibility boundaries during implementation

## Trade-offs

- Requires local `fga serve` availability for proxy-mode workflows
- Adds operational surface area (local service lifecycle and proxy security controls)
- Browser-only direct setups remain simpler for unauthenticated/same-origin use cases

## Consequences

- Proxy implementation work is constrained by explicit decisions (endpoint shape, config path, adapter contract).
- Frontend adapter and backend proxy can evolve independently as long as the proxy contract remains stable.
- Direct mode and future WASM mode remain compatible with the same `BackendAdapter` abstraction.

## Rollout Note

Initial release availability remains direct-first, with proxy delivered in fast-follow and WASM later (see ADR-008 and ADR-010).
