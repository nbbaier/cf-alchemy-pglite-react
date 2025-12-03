# Agent Development Guide

## Commands
- **Build**: `bun run build` - Build the application
- **Dev**: `bun run dev` - Start development server with Alchemy
- **Deploy**: `bun run deploy` - Deploy to Cloudflare
- **Lint**: `bunx @biomejs/biome check --write` - Run linter and auto-fix
- **Format**: `bunx @biomejs/biome format --write` - Format code
- **Type Check**: `tsc --noEmit` - Run TypeScript type checking

## Code Style
- **Formatter**: Biome with tab indentation, double quotes
- **Imports**: Organized automatically by Biome, use `@/` alias for src/
- **Types**: Strict TypeScript enabled, use `tsx` for React components
- **Components**: Use shadcn/ui patterns with class-variance-authority
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Error Handling**: Use proper error boundaries and toast notifications

## Key Patterns
- **Routing**: TanStack Router with file-based routing in `/routes`
- **Database**: PGlite for local SQLite database operations
- **Styling**: Tailwind CSS with custom design system tokens
- **State**: React hooks and context for local state management
- **API**: Cloudflare Workers with Alchemy infrastructure bindings

## Testing
No test framework configured. Add tests using your preferred framework (Vitest, Jest, etc.) when needed.