# Contributing

Thanks for helping improve **SQL Schema Visualizer**. Bug reports, dialect edge cases, and PRs are all welcome.

## Setup

```bash
git clone https://github.com/khanakia/sql-schema-visualizer.git
cd sql-schema-visualizer
npm install
npm run dev
```

[Task](https://taskfile.dev) shortcuts (optional): `task dev`, `task build`, `task preview`, `task routes`.

## Before you open a PR

```bash
npm run build   # tsc -b && vite build — this is the gate, it must pass
npm run lint    # eslint
```

`npm run build` runs the TypeScript typecheck first; a green build is required. On a fresh checkout, generate the router tree once before the first typecheck: `npx tsr generate` (or run `npm run build` twice — the first pass materialises `src/routeTree.gen.ts`).

## Reporting a parser bug

The most valuable contributions are SQL the parser mangles. When filing an issue, include:

1. The exact `CREATE TABLE` / `ALTER TABLE` snippet (minimal repro).
2. The dialect (PostgreSQL / MySQL / SQLite / other).
3. What you expected vs. what rendered (a screenshot helps).

If you fix it, add the snippet to `src/lib/samples.ts` or as a regression case so it doesn't break again.

## Code style

- TypeScript, no `any` unless unavoidable and commented.
- Match the surrounding code — small functions, early returns, no clever one-liners in the parser.
- The parser is intentionally **tolerant**: never throw on unrecognised SQL; skip the clause and, where it could be mistaken for a real empty result, push a message to `warnings[]`.
- UI is Tailwind utility classes; keep the dark theme consistent (`#0a0b0f` / `#14151b` / purple accent).
- Read [CONTEXT.md](CONTEXT.md) before touching `parser.ts` or `Canvas.tsx` — there are documented gotchas (the React Flow `fitView` prop, comment association heuristic) that will bite if ignored.

## Commit & PR

- Small, focused commits with clear messages.
- One logical change per PR; describe the SQL or interaction it affects.
- Note any new known-limitation in CONTEXT.md if your change introduces a tradeoff.

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
