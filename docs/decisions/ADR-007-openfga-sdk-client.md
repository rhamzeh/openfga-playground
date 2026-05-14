# ADR-007: @openfga/sdk as API Client

## Status

Accepted

## Decision

Use `@openfga/sdk`'s `OpenFgaClient` as the API client throughout the playground. The client is configured with `apiUrl` pointing at `fga serve`'s proxy endpoint. No custom HTTP logic for OpenFGA API calls.

## Context

The playground must make OpenFGA API calls: `check`, `write`, `read`, `writeAuthorizationModel`, `readAuthorizationModels`, `createStore`, `listStores`, etc. These calls need to go through the `fga serve` proxy.

## Rationale

The SDK already provides:

- **Typed methods** for every OpenFGA API operation with correct request/response types.
- **Serialization**: Request bodies and response parsing handled correctly.
- **Type definitions**: `RelationshipTuple`, `AuthorizationModel`, `ClientCheckRequest`, etc. are exported from the SDK. The playground re-uses these types rather than duplicating them.
- **Proxy compatibility**: `OpenFgaClient` is configured with `apiUrl` only. It constructs standard OpenFGA API paths (e.g., `/stores/:storeId/check`) and appends them to the base URL. When `apiUrl` points to `http://localhost:8880/servers/:id/proxy`, the SDK sends requests to `http://localhost:8880/servers/:id/proxy/stores/:storeId/check`. The proxy strips its own prefix and forwards the remainder to the upstream.
- **Future-proof**: When the SDK adds new API operations (e.g., `listObjects`, `listUsers`), the playground can use them immediately without code changes.

### ProxyBackendAdapter pattern

```typescript
getClient(serverId: string): OpenFgaClient {
  return new OpenFgaClient({
    apiUrl: `http://localhost:8880/servers/${serverId}/proxy`,
    // storeId and authorizationModelId are set per-request or via the SDK
  });
}
```

The shell passes `storeId` and `authorizationModelId` when creating clients for specific operations, or sets them on a per-request basis via SDK method parameters.

## Trade-offs

- Tight coupling to `@openfga/sdk` types. However, these types are stable and versioned; the playground tracks SDK minor versions.
- The SDK's `apiUrl` path convention must match how `fga serve` strips the proxy prefix. This is a straightforward convention, not a complex contract.
- Third-party `BackendAdapter` implementations that do not use `fga serve` still return an `OpenFgaClient` (or a compatible interface) from `getClient()`. This means they also depend on `@openfga/sdk`.

## Alternatives Considered

- **Custom fetch wrapper**: Write a typed HTTP client from scratch for OpenFGA API calls. Significant implementation and maintenance burden. Would require updating whenever the API changes. Not worth it when the official SDK exists.
- **OpenAPI-generated client**: Generate a client from the OpenFGA OpenAPI spec. Equivalent to the SDK approach but without the SDK team's quality control, retry logic, and type refinements.
