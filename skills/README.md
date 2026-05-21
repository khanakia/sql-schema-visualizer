# Skills

[skills.sh](https://skills.sh)-compatible agent skills shipped with this repo. Each subdirectory is one skill — `SKILL.md` + any supporting files.

## Install

```bash
# install every skill in this repo, into the current project
npx skills add khanakia/sql-schema-visualizer

# list what's available without installing
npx skills add khanakia/sql-schema-visualizer --list

# install a specific skill, globally, for Claude Code only
npx skills add khanakia/sql-schema-visualizer --skill sql-prep -g -a claude-code -y
```

Works with **Claude Code**, **OpenCode**, **Codex**, **Cursor**, and [the others skills.sh supports](https://skills.sh).

## Available skills

| Skill | What it does |
|---|---|
| [`sql-prep`](./sql-prep/SKILL.md) | Annotates a `.sql` file with `-- @group:` tags and `/* @doc */` markdown descriptions so the [SQL Schema Visualizer](https://khanakia.com/apps/sql-schema-visualizer/) renders it richly. Proposes the grouping + descriptions first (you trim/approve), then writes back. |
