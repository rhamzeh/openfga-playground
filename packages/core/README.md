# @openfga/playground-core

Pure TypeScript state management and backend adapter for the OpenFGA Playground.

## Overview

This package is the headless core of the OpenFGA Playground. It contains:

- **State management** — nanostores atoms for model, tuples, assertions, stores, and connection profiles
- **Backend adapter interface** — extensible `BackendAdapter` contract for different OpenFGA deployments
- **Proxy adapter** — `ProxyBackendAdapter` that talks to `fga serve` for profile CRUD and proxies OpenFGA API calls
- **Validation orchestrator** — wraps `@openfga/syntax-transformer` with debounced validation
- **YAML import/export** — reads and writes `.fga.yaml` files compatible with the `fga` CLI

No DOM APIs. No UI. Works in Node.js and the browser.

## Installation

```bash
npm install @openfga/playground-core
```

## Usage

```typescript
import {
  $model,
  $tuples,
  $activeStore,
  updateModel,
  setBackendAdapter,
  ProxyBackendAdapter,
} from '@openfga/playground-core';

// Configure the backend
const adapter = new ProxyBackendAdapter('http://localhost:8880', 'my-profile-id');
setBackendAdapter(adapter);

// Read state
const model = $model.get();
console.log(model.dsl, model.errors);

// Subscribe to changes
$model.subscribe((m) => console.log('model changed', m.dsl));

// Update model (triggers debounced validation)
updateModel('model\n  schema 1.1\ntype user');
```

## API

### State atoms

| Atom | Type | Description |
|---|---|---|
| `$model` | `ModelState` | Current authorization model (DSL, JSON, validation errors) |
| `$tuples` | `TupleState` | Relationship tuples in the active store |
| `$assertions` | `AssertionState` | Check assertions and their results |
| `$activeStore` | `StoreState` | Active FGA store (id, name) |
| `$activeModelId` | `string \| null` | Active model version ID |
| `$servers` | `ServersState` | Connection profiles (name, url, auth, capabilities) |
| `$activeServerId` | `string \| null` | ID of the active connection profile |

### Actions

```typescript
// Model
updateModel(dsl: string): void
setActiveModelId(id: string | null): void

// Stores
setActiveStore(id: string, name: string): void

// Tuples
addTuple(tuple: TupleKey): Promise<void>
removeTuple(tuple: TupleKey): Promise<void>

// Assertions
setAssertions(assertions: AssertionData[]): void
runAssertion(assertion: AssertionData): Promise<void>
runAllAssertions(): Promise<void>

// Servers
addServer(config: ServerConfig): string
removeServer(id: string): void
setActiveServer(id: string): void

// YAML
importFromYaml(yaml: string): Promise<void>
exportToYaml(): Promise<string>

// Backend
setBackendAdapter(adapter: BackendAdapter): void
```

### BackendAdapter interface

```typescript
export interface BackendAdapter {
  // Returns an OpenFgaClient pointed at the given store
  getClient(storeId: string): OpenFgaClient;

  // Profile CRUD (maps to fga serve profile endpoints)
  listProfiles(): Promise<PublicProfile[]>;
  createProfile(config: ServerConfig): Promise<PublicProfile>;
  updateProfile(id: string, config: Partial<ServerConfig>): Promise<PublicProfile>;
  deleteProfile(id: string): Promise<void>;
}
```

Implement this interface to support custom OpenFGA deployments (e.g., Auth0 FGA, a hosted instance).

## Capability gating

Connection profiles include a `capabilities` object controlling which API operations are available:

```typescript
capabilities: {
  storeCrud: boolean;    // CreateStore, ListStores, DeleteStore
  listModels: boolean;   // ReadAuthorizationModels
}
```

Always check these flags before calling gated SDK methods. The adapter will not enforce this — it is the caller's responsibility.

## License

Apache-2.0
