# ADR-003: Nanostores for State Management

## Status

Accepted

## Decision

Use [nanostores](https://github.com/nanostores/nanostores) for reactive state management in `@openfga/playground-core`, with `@nanostores/lit` for Lit bindings in the playground shell.

## Context

The playground state (servers, active store, model, tuples, assertions, results) must be:

- Reactive: UI updates automatically when state changes
- Framework-agnostic: core package must have no framework dependency (no React, no Lit)
- Shareable: multiple components can subscribe to the same atoms without prop-drilling
- Testable: state can be read and written in unit tests without DOM setup

## Rationale

- **<1KB**: nanostores is tiny. Atoms (`atom`) and maps (`map`) are the only primitives needed.
- **Framework-agnostic**: The core package uses plain nanostores. The Lit shell uses `@nanostores/lit`'s `StoreController` for automatic re-rendering on state change. Future adapters (React, Vue) can use `@nanostores/react`, `@nanostores/vue`, etc.
- **First-class Lit bindings**: `StoreController` integrates with Lit's reactive update lifecycle — subscribes on `connectedCallback`, unsubscribes on `disconnectedCallback`, triggers `requestUpdate()` on change.
- **No boilerplate**: Reading state is `$atom.get()`, writing is `$atom.set(value)`. No reducers, no action creators, no selectors layer required at this scale.
- **Testable**: `$atom.set()` and `$atom.get()` work in Node.js without DOM. Unit tests for state actions are straightforward.

## Trade-offs

- Less ecosystem/devtools than Zustand or MobX (no Redux DevTools equivalent).
- No built-in computed/derived values (use `computed()` from nanostores for those).
- No time-travel debugging. Acceptable for this scope.

## Alternatives Considered

- **Zustand**: Better React ecosystem fit, but core package would pull in React concepts. Not framework-agnostic enough.
- **MobX**: Excellent reactivity, but ~15KB and introduces observable proxies that can be surprising. Overkill for this scale.
- **Redux Toolkit**: Excellent DevTools and time-travel. Massive overkill; significant boilerplate. Not framework-agnostic by convention.
- **RxJS BehaviorSubject**: Framework-agnostic and powerful, but ~50KB and a steep learning curve for contributors not already familiar with Rx.
- **Custom event bus**: Lightweight but no type safety on state shape, no reactive subscriptions.
