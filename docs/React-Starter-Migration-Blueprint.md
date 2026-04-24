# React Starter Migration Blueprint

## Objective

Migrate `skripsi_backend` from a backend-first Laravel application into a full-stack Laravel and React application using an Inertia-based web shell, while preserving the existing clinic domain logic:

- reservation flow
- queue management
- medical record completion
- reports export
- notifications
- clinic-scoped authorization

## Current Constraints

This repository is not a fresh Laravel React starter kit. It already contains:

- custom authentication APIs in `routes/api.php`
- custom role authorization middleware
- domain-heavy controllers and services
- Sanctum-based authenticated API access
- existing Postman contracts that should remain stable

Because of this, migration should not be done as a destructive overwrite.

## Migration Strategy

### Phase 1: Frontend Foundation

Goal:

- Add Inertia + React + TypeScript infrastructure.
- Keep all business APIs unchanged.
- Add a new web shell for landing, login, register, password reset, and dashboard.

Changes:

- install `inertiajs/inertia-laravel`
- install React, Inertia React adapter, TypeScript, React Vite plugin
- add Inertia middleware and root Blade view
- create `resources/js` page structure
- add web routes for guest and authenticated screens
- keep `/api/*` reservation and queue endpoints untouched

### Phase 2: Auth Consolidation

Goal:

- Decide whether to keep using the current custom auth controller behind the new React forms, or replace it gradually with starter-kit style Fortify flows.

Safer option:

- keep current backend auth behavior
- keep web React forms posting to `/api/login`, `/api/register`, `/api/forgot-password`, `/api/reset-password`

Riskier option:

- replace backend auth routes and controllers with starter-kit conventions

Recommendation:

- keep current backend auth behavior until the domain pages are already stable

### Phase 3: Feature Page Migration

Migrate pages incrementally into React:

1. dashboard
2. reservations
3. queue management
4. doctor queue
5. medical records
6. reports
7. clinic settings
8. user/profile pages

Recommended rule:

- frontend pages may call existing `/api/*` endpoints first
- only after a page is stable should its data-loading be reconsidered for deeper Inertia integration

### Phase 4: Contract Cleanup

Goal:

- reduce duplicated web and API concerns only after the React workspace is stable

Possible actions:

- move some read-only pages to direct Inertia props
- keep mutation-heavy workflows on API endpoints if they are already stable and well-tested

## Main Collision Points

### Authentication

Potential collision:

- current auth routes are custom and live under `routes/api.php`
- official starter kits assume Fortify-backed auth conventions

Impact:

- login/register/reset pages can break if both conventions are mixed carelessly

### Routing

Potential collision:

- current web routes are almost empty
- current API routes hold most application behavior

Impact:

- page routing and API routing can diverge if names and middleware are not kept clear

### Session and Middleware

Potential collision:

- current app uses Sanctum and a custom `authorize` middleware alias
- guest redirect logic already exists in `bootstrap/app.php`

Impact:

- wrong guard or middleware ordering can break authenticated page access

### Frontend Tooling

Potential collision:

- current repo started from a simple Vite setup without React/Inertia

Impact:

- React plugin and TypeScript need to be added carefully to avoid breaking the existing asset build

## What Must Stay Stable

The following should be treated as protected core during migration:

- database schema and models
- reservation queue services
- medical record completion rules
- clinic-scoped authorization
- report exports
- notification dispatching
- Postman-tested business endpoints

## What Can Change More Aggressively

These are safer to refactor:

- landing page
- login page
- register page
- forgot password page
- reset password page
- general dashboard shell

## Acceptance Criteria For Migration

The migration is healthy if:

- `/api/*` business endpoints still pass their tests
- authenticated users can access a React-rendered dashboard
- guest users can access React-rendered auth pages
- session login still produces a valid authenticated state
- reservation and queue flows remain untouched on the backend side

## Recommended Execution Rule

Do not rewrite everything in one pass.

Move page-by-page while treating the domain API as the stable backbone until the React workspace fully replaces the old UI layer.
