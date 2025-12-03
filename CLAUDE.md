# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + TypeScript + Vite application deployed via Alchemy on Cloudflare Workers. The application provides CSV upload, analysis, and querying capabilities using PGlite (Postgres in WebAssembly) running entirely in the browser via IndexedDB persistence.

## Development Commands

### Core Commands
- `bun run dev` - Start local development server with Alchemy dev mode (hot reload, local workers)
- `bun run build` - Build the Vite application for production
- `bun run preview` - Preview production build locally
- `bun run lint` - Lint the codebase using ESLint
- `alchemy deploy` - Deploy infrastructure and application to Cloudflare
- `alchemy destroy` - Tear down all deployed Cloudflare resources

### Package Management
- This project uses **Bun** as the package manager (not npm/yarn/pnpm)
- Use `bun add <package>` to add dependencies
- Use `bun install` to install dependencies

### Code Formatting
- Code formatting is managed by **Biome** (not Prettier/ESLint formatter)
- Biome config: `biome.json` - uses tab indentation and double quotes
- No explicit format command is configured; use your editor's Biome integration

## Architecture

### Infrastructure Layer (Alchemy)

**Entry Point**: `alchemy.run.ts`
- Defines infrastructure using TypeScript-native Alchemy framework
- Creates a Vite-based worker that bundles and serves the React application
- Uses `CloudflareStateStore` for deployment state management
- Worker URL is logged on startup for easy access

**Worker**: `src/worker.ts`
- Minimal Cloudflare Worker with a simple `/api/*` handler (placeholder)
- Vite automatically handles static asset serving and client-side routing

**Type Safety**: `types/env.d.ts`
- Declares worker environment bindings for TypeScript
- Uses module augmentation to make Cloudflare types available globally

### Frontend Layer (React + TanStack Router)

**Entry Point**: `src/main.tsx`
- Creates router from generated route tree (`routeTree.gen.ts`)
- Registers router type globally via module declaration for type inference
- Renders application with `RouterProvider`

**Routing**: File-based routing via TanStack Router
- Route files in `src/routes/` automatically generate route tree
- `src/routeTree.gen.ts` is **generated** and **committed** to git
- Router uses Vite plugin (`@tanstack/router-plugin`) for route generation
- Module declaration in `main.tsx` provides global type safety for routing

**Root Layout**: `src/routes/__root.tsx`
- Provides navigation by scanning all routes dynamically
- Filters out private routes (`/_*`), dynamic routes (`$`), and nested index routes
- Includes `<Toaster>` for notifications and `<TanStackRouterDevtools>`
- Uses `<Outlet>` for nested route rendering

**Routes**:
- `/` - Index route
- `/pglite` - CSV upload, SQL editor, data table viewer
- `/upload` - Dedicated upload page

### Database Layer (PGlite)

**Initialization**: Database instance created in `src/routes/pglite.tsx`
- Uses IndexedDB for persistence (`idb://csv-analyzer`)
- Live extension enabled for reactive queries
- Single global instance (`dbGlobal`) wrapped with `PGliteProvider`

**Database Utilities**: `src/lib/database-utils.ts`

Key functions:
- `sanitizeSqlIdentifier(identifier)` - Sanitizes table/column names for SQL safety
- `createTableFromCSV(db, tableName, columns, rows)` - Creates tables with automatic type inference
- `determineColumnType(columnValues)` - Infers Postgres column types (TEXT, INTEGER, REAL, DATE, BOOLEAN)
- `inferDataType(value)` - Determines data type for a single value

Type Inference Strategy:
- Samples first 100 non-empty values per column
- Uses early exit optimization (>10% TEXT values → TEXT type)
- Priority: BOOLEAN (100% match) → REAL → INTEGER → DATE → TEXT (fallback)
- Handles NULL values and empty strings gracefully

Data Import:
- Batches inserts in groups of 500 rows for performance
- Uses transactions (BEGIN/COMMIT/ROLLBACK) for data integrity
- Drops existing tables before creating new ones (CASCADE)

### Component Architecture

**Data Table Components**: TanStack Table + Shadcn UI
- `data-table.tsx` - Main table component with filtering, sorting, pagination
- `data-table-toolbar.tsx` - Search and filter controls
- `data-table-pagination.tsx` - Pagination controls
- `data-table-column-header.tsx` - Sortable column headers
- `data-table-faceted-filter.tsx` - Multi-select faceted filtering
- `data-table-view-options.tsx` - Column visibility toggle
- `data-table-row-actions.tsx` - Row-level actions (edit, delete, etc.)

**CSV Upload**: `components/csv-upload.tsx`
- Drag-and-drop + file input
- Multiple file support
- Size validation (default 5MB max)
- Uses PapaParse for CSV parsing
- Input validation with descriptive error messages

**SQL Editor**: `components/editor.tsx`
- CodeMirror 6 with SQL language support
- Keyboard shortcut (Cmd/Ctrl+Enter) to execute query
- "Run Query" button for query execution

**UI Components**: `components/ui/`
- Shadcn UI components (button, dialog, checkbox, table, etc.)
- Radix UI primitives for accessibility
- Tailwind CSS v4 for styling (via Vite plugin)

### Utilities

**Logger**: `src/lib/logger.ts`
- Environment-aware logging (console methods only active in dev mode)
- Methods: `debug`, `log`, `info`, `warn`, `error`
- `warn` and `error` always log regardless of environment

**Utils**: `src/lib/utils.ts`
- `cn()` - Tailwind class merging utility (clsx + tailwind-merge)

**CSV Utils**: `src/lib/csv.ts`
- CSV parsing and validation utilities

## Important Patterns

### TanStack Router Best Practices
- Always use file-based routing (don't manually edit `routeTree.gen.ts`)
- Use `createFileRoute()` in route files, not `createRoute()`
- Module declaration for router is in `main.tsx` - don't repeat elsewhere
- Route files should export `Route` constant with route configuration
- Devtools should be included in root route for automatic connection

### PGlite Patterns
- Create single global database instance to avoid multiple connections
- Use `PGliteProvider` to share database across component tree
- Use `usePGlite()` hook to access database in components
- Always sanitize user input before using in SQL queries
- Prefer parameterized queries (`db.query(sql, params)`) over string interpolation

### Data Flow
1. User uploads CSV via `CSVUpload` component
2. CSV parsed and validated by PapaParse
3. `createTableFromCSV()` infers column types and creates table
4. Table data displayed via TanStack Table components
5. User can write SQL queries in `CodeEditor`
6. Query results displayed in same table component

### Type Safety
- TypeScript `strict` mode enabled
- Use `@/` path alias for `src/` directory imports
- Cloudflare Worker types via `@cloudflare/workers-types`
- Router types inferred globally via module declaration
- PGlite types available via `@electric-sql/pglite`

## Configuration Files

### TypeScript (`tsconfig.json`)
- Target: esnext
- JSX: react-jsx (automatic runtime)
- Module resolution: Bundler
- Base URL: `.` with `@/*` alias to `./src/*`
- Strict mode enabled

### Vite (`vite.config.ts`)
- Plugins: TanStack Router (with auto-code-splitting), React, Alchemy, Tailwind
- PGlite excluded from optimization (must remain external)
- Build target: esnext
- External modules: fs, path, crypto (Node.js built-ins)

### Alchemy (`alchemy.run.ts`)
- Uses `Vite()` resource type (not `Worker()`) for framework integration
- Entry point: `src/worker.ts`
- Cloudflare state store for production deployments

## Development Workflow

1. Start development server: `bun run dev`
2. Alchemy watches for infrastructure changes and hot-reloads worker
3. Vite provides HMR for React components
4. TanStack Router watches route files and regenerates route tree
5. Changes to `alchemy.run.ts` require restart

## Cursor Rules Context

The `.cursor/rules/` directory contains comprehensive documentation for:
- **Alchemy + Cloudflare**: Infrastructure patterns, resources, deployment (`alchemy_cloudflare.mdc`)
- **TanStack Router**: File-based routing, type safety, search params, data loading (multiple `.mdc` files)

These rules are used by Cursor AI and provide deep context on framework-specific patterns.

## Key Dependencies

### Core Framework
- React 19.2.0 + React DOM 19.2.0
- TanStack Router 1.136.18 (file-based routing, type-safe navigation)
- Vite 6.4.1 (build tool, dev server)
- Alchemy 0.69.0 (infrastructure as code)

### Database
- @electric-sql/pglite 0.3.14 (Postgres in WASM)
- @electric-sql/pglite-react 0.2.32 (React hooks and context)

### UI Framework
- Tailwind CSS 4.1.17 (utility-first CSS)
- Radix UI (accessible component primitives)
- TanStack Table 8.21.3 (headless table library)
- Lucide React (icon library)

### Code Editor
- @uiw/react-codemirror 4.25.3 (React wrapper for CodeMirror)
- @codemirror/lang-sql 6.10.0 (SQL language support)

### Data Processing
- PapaParse 5.5.3 (CSV parsing)
- Zod 4.1.12 (schema validation)

## Deployment

### Prerequisites
- Cloudflare account with Wrangler CLI authenticated (`bun wrangler login`)
- Environment variable: `ALCHEMY_PASSWORD` (for state encryption) in `.env`

### Deployment Process
1. `alchemy deploy` builds and deploys infrastructure
2. Vite builds optimized production bundle
3. Alchemy creates/updates Cloudflare Worker
4. Worker URL is displayed in console
5. State stored in Cloudflare (via `CloudflareStateStore`)

### Cleanup
- `alchemy destroy` removes all resources (worker, KV, etc.)
- Local state cleared, Cloudflare resources deleted

## Common Gotchas

1. **Route Tree**: `routeTree.gen.ts` is generated - don't edit manually, but DO commit it
2. **PGlite Optimization**: PGlite must be excluded from Vite's `optimizeDeps` or it breaks
3. **Module Declaration**: Router type registered in `main.tsx` - don't duplicate elsewhere
4. **Alchemy Finalize**: Always call `app.finalize()` in `alchemy.run.ts` to clean orphaned resources
5. **SQL Injection**: Always use `sanitizeSqlIdentifier()` and parameterized queries
6. **Bun vs NPM**: This project uses Bun - don't use npm/yarn/pnpm commands
7. **Logger**: Debug logs only show in development - use `warn`/`error` for production logs
