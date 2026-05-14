# OpenFGA Playground

An interactive web application for working with [OpenFGA](https://openfga.dev) authorization servers. Model authorization logic, manage tuples, run assertions, and visualize access graphs — all in the browser.

## Features

| Feature | Status |
|---|---|
| Model editor with DSL/JSON toggle and validation | ✅ |
| Tuple manager | ✅ |
| Assertion runner | ✅ |
| Query runner (Check, ListObjects, ListRelations) | ✅ |
| Model graph visualization | ✅ |
| Model versioning and compare | ✅ |
| Resolution path viewer | ✅ |
| Relationship graph | ✅ |
| Direct connection to an OpenFGA server | ✅ |
| Proxy mode via `fga serve` | ⏳ Planned |
| WASM (offline) mode | ⏳ Planned |

## Quick start

### Prerequisites

- Node.js >= 20
- pnpm 9

### Run locally

```bash
make install
make dev
# → http://localhost:5173
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## AI Assistance

This repository includes work produced with AI assistance.

## License

Apache-2.0 — see [LICENSE](LICENSE).
