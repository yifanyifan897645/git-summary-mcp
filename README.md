# git-summary-mcp

An MCP server that gives AI assistants deep understanding of your local Git repositories. Get instant repo overviews, semantic change summaries, blame analysis, auto-generated changelogs, branch health checks, and history search — all from within Claude, Cursor, or any MCP client.

## Quick Start

```bash
npx git-summary-mcp
```

Zero config. No API keys. No accounts. Just run it in any Git repository.

## Tools

### `git_summary`
Structured overview of a repository: current branch, recent commits, contributors, and stats.

```
"Summarize this repository"
"Who are the top contributors?"
"Show me the last 10 commits"
```

### `git_changes`
Semantic change summary for any commit range. See what files changed, who changed them, and the overall diff stat.

```
"What changed between v1.0 and v2.0?"
"Summarize the changes in the last week"
"What did the feature branch change?"
```

### `git_blame`
Analyze file ownership: who wrote each line, when, and in which commit. Get contributor breakdowns.

```
"Who last modified src/index.ts?"
"Show me the blame for lines 50-100 of app.py"
"Who owns most of this file?"
```

### `git_changelog`
Auto-generate a changelog grouped by commit type (features, fixes, docs, etc.) using conventional commit detection.

```
"Generate a changelog for the last release"
"Create release notes from v1.0 to v2.0"
```

### `git_branch_health`
Find stale branches, merged branches ready for cleanup, and branches that are ahead/behind.

```
"Which branches are stale?"
"Any branches that have been merged and can be deleted?"
"Show me branch health"
```

### `git_search`
Search through commit messages and code changes (pickaxe search) to find when something was introduced or changed.

```
"When was the login function added?"
"Find commits that mention 'authentication'"
"When was this config value changed?"
```

## Installation

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "git-summary": {
      "command": "npx",
      "args": ["-y", "git-summary-mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "git-summary": {
      "command": "npx",
      "args": ["-y", "git-summary-mcp"]
    }
  }
}
```

### Windsurf

Add to your MCP configuration with the same format as above.

## Why?

AI coding assistants can read files and run commands, but they don't inherently *understand* your project's history. This MCP server gives them structured, token-efficient Git intelligence so they can:

- Understand who worked on what and when
- Generate accurate changelogs and release notes
- Find when bugs were introduced
- Identify stale branches and cleanup opportunities
- Summarize changes for code reviews and PRs

## Requirements

- Node.js 18+
- Git installed and available in PATH
- Must be run inside (or pointed at) a Git repository

## Part of the MCP Toolkit

**[View all servers →](https://yifanyifan897645.github.io/mcp-toolkit/)**

- [webcheck-mcp](https://www.npmjs.com/package/webcheck-mcp) — Website health analysis
- [git-summary-mcp](https://www.npmjs.com/package/git-summary-mcp) — Git repository intelligence
- [mcp-checkup](https://www.npmjs.com/package/mcp-checkup) — MCP setup health analyzer
- [dev-utils-mcp](https://www.npmjs.com/package/dev-utils-mcp) — Developer utilities
- [codescan-mcp](https://www.npmjs.com/package/codescan-mcp) — Codebase health scanner
- [deadlink-checker-mcp](https://www.npmjs.com/package/deadlink-checker-mcp) — Dead link detector

## License

MIT
