# HireAI Architecture (Scalable Structure)

This project follows a split architecture:

- `client/` → Vite + React frontend
- `server/` → Express + Socket.io API runtime
- `docs/` → deployment and operations guides

## Backend structure

- `server/index.js`
  - Runtime entrypoint (startup lifecycle, background jobs, process signal/error handling).
- `server/bootstrap/createApp.js`
  - HTTP app composition (security middleware, CORS, rate limits, health/ready probes, route wiring).
- `server/routes/`
  - Route-level transport handlers.
- `server/services/`
  - Business logic and external provider adapters.
- `server/models/`
  - Data access and persistence operations.
- `server/middleware/`
  - Cross-cutting concerns such as auth, request context, and error handling.

## Frontend structure

- `client/src/pages/`
  - Route/page-level components.
- `client/src/components/`
  - Reusable UI building blocks.
- `client/src/lib/`
  - Client integration utilities (API, socket, theme helpers).
- `client/src/landing/`
  - Isolated public landing page sections.

## Scalability guardrails

1. Keep entrypoints thin.
   - Runtime orchestration stays in `server/index.js`.
   - Request pipeline and route mounting stay in `server/bootstrap/createApp.js`.
2. Add new capability by layer.
   - API contract in `routes/` → behavior in `services/` → persistence in `models/`.
3. Preserve independent quality gates.
   - Root `npm test` runs backend tests and frontend production build.
4. Control bundle growth.
   - Vite vendor chunking is configured for major dependency groups.

## Recommended next scalability steps

- Add ESLint + Prettier at root and enforce in CI.
- Add route-level input schemas for all write endpoints.
- Add API contract tests for critical user journeys.
- Move heavy page features to route-level lazy imports.
