# SQL Schema Visualizer

**Free, fast, in-browser database schema visualizer.** Paste your SQL `CREATE TABLE` statements and instantly get a smooth, interactive ER diagram — no signup, no backend, nothing leaves your browser.

> Tried every database schema diagram tool and they're all slow, clunky, or paywalled? This one isn't. Paste DDL, see your schema.

**▶ Live demo: [khanakia.github.io/sql-schema-visualizer](https://khanakia.github.io/sql-schema-visualizer/)**

![SQL Schema Visualizer dark mode — interactive ER diagram of a PostgreSQL e-commerce schema with foreign keys and inline column comments](docs/screenshot-dark.png)

<p align="center"><em>Dark mode — paste DDL, get an interactive ER diagram with FK edges and inline SQL comments.</em></p>

![SQL Schema Visualizer light mode — database schema diagram with sidebar table navigation and toolbar](docs/screenshot-light.png)

<p align="center"><em>Light mode — sidebar table/field search, collapsible tables, and the canvas toolbar.</em></p>

[![Made with React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Why

Most SQL schema visualization tools are either paid, require a live database connection, ship your schema to a server, or feel sluggish on anything bigger than a toy database. **SQL Schema Visualizer** is a single-page app that parses DDL entirely client-side and renders a fluid, navigable diagram of your tables and relationships.

- 🔒 **100% client-side** — your schema never leaves the browser
- ⚡ **Fast & smooth** — pan, zoom, drag a 40+ table schema without lag
- 🆓 **Free & open source** — MIT licensed, no account, no limits
- 🧩 **Multi-dialect** — PostgreSQL, MySQL, SQLite, generic ANSI SQL

## Features

- **Tolerant multi-dialect SQL parser** — handles PostgreSQL, MySQL, SQLite and ANSI `CREATE TABLE` / `ALTER TABLE`, including backticks, `[brackets]`, `"quotes"`, schema prefixes, `AUTO_INCREMENT`/`AUTOINCREMENT`, `UNSIGNED`, composite keys and inline / table-level foreign keys.
- **Interactive canvas** — pan, zoom, drag nodes, auto-layout (horizontal or vertical), minimap, fit-to-view.
- **Figma-style navigation** — two-finger / trackpad scroll pans, ⌘/Ctrl+scroll zooms, double-click zooms in.
- **Smart search** — filter by table *or* column name; matching tables expand to show the hit fields.
- **Click to navigate** — jump straight to any table or field; the canvas centers and highlights it.
- **SQL comments preserved** — table- and column-level `--` / `#` comments are captured and shown inline or as hover popovers (toggle: off → inline → hover).
- **Foreign-key edges** — column-to-column relationship lines with PK / FK / NOT NULL markers.
- **Import** — paste DDL or upload a `.sql` file. Built-in sample schemas (e-commerce, blog, SaaS).
- **Export** — one-click PNG of the full diagram.
- **Dark UI**, keyboard-friendly, state persisted to `localStorage`.

## Quick start

```bash
git clone https://github.com/khanakia/sql-schema-visualizer.git
cd sql-schema-visualizer
npm install
npm run dev
```

Open the printed local URL, switch to the **SQL** tab in the sidebar, paste your `CREATE TABLE` statements (or upload a `.sql` file), and the diagram renders instantly.

Build for production:

```bash
npm run build && npm run preview
```

If you have [Task](https://taskfile.dev) installed, `task dev` / `task build` / `task preview` are also wired up.

## Supported SQL

| Dialect | Notes |
|---|---|
| PostgreSQL | `SERIAL`, `TIMESTAMPTZ`, schema-qualified names, array types |
| MySQL | backtick identifiers, `AUTO_INCREMENT`, `ENGINE=`, `UNSIGNED` |
| SQLite | `AUTOINCREMENT`, minimal type system |
| ANSI / generic | best-effort parse, unknown clauses skipped rather than failing |

The parser is deliberately forgiving: a partially-understood dump still produces a useful diagram, with warnings surfaced in the sidebar.

## Tech stack

React 19 · TypeScript · Vite · TanStack Router · React Flow (`@xyflow/react`) · dagre (auto-layout) · Tailwind CSS · Zustand · html-to-image.

See [CONTEXT.md](CONTEXT.md) for the full technical architecture, parser design, and known limitations.

## Contributing

Issues and PRs welcome — especially SQL dialect edge cases. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © khanakia
