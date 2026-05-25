# Repository Guidelines

## Required Workflow
Before editing code, read this file plus `docs/domain-rules.md` and `docs/system-change-log.md`. If a task changes system structure, business rules, API contracts, sheet schema, or shared UI patterns, update the relevant doc first or in the same change.

Archive legacy guidance in `docs/archive/AGENTS_OLD.md`. Do not add new rules back into archived files.

## Project Structure & Module Organization
The repository has three active areas:

- `src/`: React + Vite frontend in JSX. Use `pages/`, `components/`, `hooks/`, `utils/`, `assets/`, and `styles/` consistently.
- `apps-script/code.gs`: Google Apps Script backend for Google Sheets workflows. Preserve function names and response shapes.
- `odc-vehicle-api/src/`: Cloudflare Worker proxy API.

Generated frontend output goes to `dist/`. Do not rename Google Sheet headers without migration handling.

## Build, Test, and Development Commands
- `npm run dev`: start the frontend locally.
- `npm run build`: production frontend build. Run after every frontend change.
- `npm run lint`: ESLint for the frontend.
- `npm run preview`: preview the built frontend bundle.
- `cd odc-vehicle-api && npm run dev`: run the Worker locally.
- `cd odc-vehicle-api && npm run deploy`: deploy the Worker.

There is no formal automated test suite yet. Minimum validation is `npm run lint`, `npm run build`, and manual smoke testing of affected booking flows. For Apps Script changes, perform a syntax check and keep APIs backward compatible.

## Coding Style & Naming Conventions
Use UTF-8, LF line endings, and 2-space indentation from `.editorconfig`. Never convert encoding, rewrite Thai text unnecessarily, or save Thai UI content in ANSI. Frontend uses functional React components and hooks, not class components. Use `PascalCase` for components and `camelCase` for helpers and hooks.

## Domain, UI, and Safety Rules
Use `Asia/Bangkok` timezone and keep date formatting aligned with the booking UI: `DD/MM/YYYY HH:mm`. Core booking, queue, availability, logging, cache, and permission rules are documented in `docs/domain-rules.md`; treat that file as the source of truth before changing behavior.

Keep the UI simple, readable, and Thai senior-friendly. Use SweetAlert2 for confirmations and detail modals. Before delete or assignment actions, validate overlap, unavailability, and queue constraints.

## Logging, Cache, and Change Recording
Important actions must create append-only logs. After create, update, or delete operations, invalidate related caches. When you change repository structure or add a new persistent rule, append a dated entry to `docs/system-change-log.md` describing what changed, why, and which files or modules are affected.

## Commit & Pull Request Guidelines
Recent commits are short and informal, but contributors should prefer concise imperative messages such as `fix queue pointer update`. PRs should include changed areas, manual test notes, linked tasks, screenshots for UI changes, and a short note on schema, API, or deployment impact.
