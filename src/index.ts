#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getRepoSummary,
  getChanges,
  getBlame,
  generateChangelog,
  getBranchHealth,
  searchHistory,
} from "./git-ops.js";

const server = new McpServer({
  name: "git-summary",
  version: "0.1.0",
});

// Tool 1: Repository overview
server.tool(
  "git_summary",
  "Get a structured overview of a Git repository: current branch, recent commits, contributors, and repo stats. Works on any local Git repo.",
  {
    repo_path: z
      .string()
      .optional()
      .describe(
        "Path to the Git repository (defaults to current working directory)"
      ),
    commit_count: z
      .number()
      .optional()
      .default(20)
      .describe("Number of recent commits to include (default 20)"),
  },
  async ({ repo_path, commit_count }) => {
    const result = await getRepoSummary(repo_path, commit_count);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 2: Semantic change summary
server.tool(
  "git_changes",
  "Get a summary of changes in a commit range: what files changed, who changed them, and a diff stat. Useful for understanding what happened between two points in history.",
  {
    range: z
      .string()
      .optional()
      .describe(
        "Git commit range, e.g. 'main..feature' or 'HEAD~5..HEAD' or a tag range"
      ),
    repo_path: z
      .string()
      .optional()
      .describe("Path to the Git repository (defaults to cwd)"),
    max_commits: z
      .number()
      .optional()
      .default(30)
      .describe("Max commits to analyze (default 30)"),
  },
  async ({ range, repo_path, max_commits }) => {
    const result = await getChanges(range, repo_path, max_commits);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 3: Blame analysis
server.tool(
  "git_blame",
  "Analyze who wrote each line of a file, when, and in which commit. Get top contributors and ownership breakdown. Optionally limit to a line range.",
  {
    file: z.string().describe("File path relative to repo root"),
    repo_path: z
      .string()
      .optional()
      .describe("Path to the Git repository (defaults to cwd)"),
    start_line: z
      .number()
      .optional()
      .describe("Start line number (optional, for partial blame)"),
    end_line: z
      .number()
      .optional()
      .describe("End line number (optional, for partial blame)"),
  },
  async ({ file, repo_path, start_line, end_line }) => {
    const result = await getBlame(file, repo_path, start_line, end_line);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: Changelog generation
server.tool(
  "git_changelog",
  "Auto-generate a changelog from Git commits. Groups commits by type (feat, fix, docs, etc.) using conventional commit format. Specify a range or get the full log.",
  {
    from: z
      .string()
      .optional()
      .describe("Start commit/tag (e.g. 'v1.0.0')"),
    to: z.string().optional().describe("End commit/tag (e.g. 'v2.0.0')"),
    repo_path: z
      .string()
      .optional()
      .describe("Path to the Git repository (defaults to cwd)"),
  },
  async ({ from, to, repo_path }) => {
    const result = await generateChangelog(from, to, repo_path);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 5: Branch health check
server.tool(
  "git_branch_health",
  "Analyze all local branches: find stale branches, merged branches ready for cleanup, and branches that are ahead/behind. Helps keep your repo tidy.",
  {
    repo_path: z
      .string()
      .optional()
      .describe("Path to the Git repository (defaults to cwd)"),
  },
  async ({ repo_path }) => {
    const result = await getBranchHealth(repo_path);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 6: Search git history
server.tool(
  "git_search",
  "Search through Git history for commits matching a query. Searches both commit messages and code changes (pickaxe search). Find when a change was introduced or a bug was created.",
  {
    query: z.string().describe("Search term to find in commit messages or code changes"),
    repo_path: z
      .string()
      .optional()
      .describe("Path to the Git repository (defaults to cwd)"),
    max_results: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum results to return (default 20)"),
  },
  async ({ query, repo_path, max_results }) => {
    const result = await searchHistory(query, repo_path, max_results);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
