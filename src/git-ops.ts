import simpleGit, { SimpleGit, LogResult, DiffResult } from "simple-git";
import { resolve } from "path";
import { existsSync } from "fs";

function getGit(repoPath?: string): SimpleGit {
  const dir = repoPath ? resolve(repoPath) : process.cwd();
  if (!existsSync(dir)) {
    throw new Error(`Directory does not exist: ${dir}`);
  }
  return simpleGit(dir);
}

export interface RepoSummary {
  repo_path: string;
  current_branch: string;
  branches: {
    local: string[];
    remote: string[];
    current: string;
  };
  recent_commits: Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
  }>;
  contributors: Array<{
    name: string;
    commits: number;
    latest_commit: string;
  }>;
  stats: {
    total_commits: number;
    branches_count: number;
    has_uncommitted_changes: boolean;
    has_untracked_files: boolean;
  };
}

export async function getRepoSummary(
  repoPath?: string,
  commitCount = 20
): Promise<RepoSummary> {
  const git = getGit(repoPath);
  const dir = repoPath ? resolve(repoPath) : process.cwd();

  const [status, branchSummary, log] = await Promise.all([
    git.status(),
    git.branch(),
    git.log({ maxCount: commitCount }),
  ]);

  // Count total commits
  const allLog = await git.log(["--oneline"]);

  // Get contributors
  const contributorMap = new Map<
    string,
    { commits: number; latest: string }
  >();
  for (const commit of allLog.all) {
    const existing = contributorMap.get(commit.author_name);
    if (existing) {
      existing.commits++;
    } else {
      contributorMap.set(commit.author_name, {
        commits: 1,
        latest: commit.date,
      });
    }
  }

  const contributors = Array.from(contributorMap.entries())
    .map(([name, data]) => ({
      name,
      commits: data.commits,
      latest_commit: data.latest,
    }))
    .sort((a, b) => b.commits - a.commits);

  return {
    repo_path: dir,
    current_branch: status.current || "HEAD (detached)",
    branches: {
      local: branchSummary.all.filter((b) => !b.startsWith("remotes/")),
      remote: branchSummary.all.filter((b) => b.startsWith("remotes/")),
      current: branchSummary.current,
    },
    recent_commits: log.all.map((c) => ({
      hash: c.hash.substring(0, 8),
      date: c.date,
      message: c.message,
      author: c.author_name,
    })),
    contributors,
    stats: {
      total_commits: allLog.total,
      branches_count: branchSummary.all.length,
      has_uncommitted_changes: !status.isClean(),
      has_untracked_files: status.not_added.length > 0,
    },
  };
}

export interface ChangeSummary {
  range: string;
  commits: Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
    files_changed: number;
  }>;
  total_commits: number;
  files_touched: string[];
  diff_stat: string;
}

export async function getChanges(
  range?: string,
  repoPath?: string,
  maxCommits = 30
): Promise<ChangeSummary> {
  const git = getGit(repoPath);

  const logArgs: string[] = [];
  if (range) logArgs.push(range);

  const log = await git.log([...logArgs, `--max-count=${maxCommits}`]);

  // Get diff stat for the range
  let diffStat = "";
  try {
    if (range) {
      diffStat = await git.raw(["diff", "--stat", range]);
    } else {
      const firstHash = log.all[log.all.length - 1]?.hash;
      const lastHash = log.all[0]?.hash;
      if (firstHash && lastHash && firstHash !== lastHash) {
        diffStat = await git.raw(["diff", "--stat", `${firstHash}..${lastHash}`]);
      }
    }
  } catch {
    diffStat = "(could not compute diff stat)";
  }

  // Collect all files touched
  const filesSet = new Set<string>();
  for (const commit of log.all) {
    try {
      const show = await git.raw([
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        commit.hash,
      ]);
      show
        .trim()
        .split("\n")
        .filter(Boolean)
        .forEach((f) => filesSet.add(f));
    } catch {
      // skip
    }
  }

  return {
    range: range || `last ${log.all.length} commits`,
    commits: log.all.map((c) => ({
      hash: c.hash.substring(0, 8),
      date: c.date,
      message: c.message,
      author: c.author_name,
      files_changed: 0, // filled by diff-tree above indirectly
    })),
    total_commits: log.total,
    files_touched: Array.from(filesSet).sort(),
    diff_stat: diffStat.trim(),
  };
}

export interface BlameInfo {
  file: string;
  lines: Array<{
    line_number: number;
    author: string;
    date: string;
    commit: string;
    content: string;
  }>;
  top_contributors: Array<{
    author: string;
    lines: number;
    percentage: string;
  }>;
}

export async function getBlame(
  filePath: string,
  repoPath?: string,
  startLine?: number,
  endLine?: number
): Promise<BlameInfo> {
  const git = getGit(repoPath);

  const args = ["blame", "--porcelain"];
  if (startLine && endLine) {
    args.push(`-L${startLine},${endLine}`);
  }
  args.push(filePath);

  const raw = await git.raw(args);
  const lines: BlameInfo["lines"] = [];
  const authorCounts = new Map<string, number>();

  const chunks = raw.split(/^([0-9a-f]{40})/gm).filter(Boolean);

  let currentAuthor = "";
  let currentDate = "";
  let currentCommit = "";
  let lineNum = 0;

  for (const line of raw.split("\n")) {
    if (/^[0-9a-f]{40}/.test(line)) {
      const parts = line.split(" ");
      currentCommit = parts[0].substring(0, 8);
      lineNum = parseInt(parts[2]) || lineNum + 1;
    } else if (line.startsWith("author ")) {
      currentAuthor = line.replace("author ", "");
    } else if (line.startsWith("author-time ")) {
      const ts = parseInt(line.replace("author-time ", ""));
      currentDate = new Date(ts * 1000).toISOString().split("T")[0];
    } else if (line.startsWith("\t")) {
      const content = line.substring(1);
      lines.push({
        line_number: lineNum,
        author: currentAuthor,
        date: currentDate,
        commit: currentCommit,
        content,
      });
      authorCounts.set(
        currentAuthor,
        (authorCounts.get(currentAuthor) || 0) + 1
      );
    }
  }

  const totalLines = lines.length || 1;
  const topContributors = Array.from(authorCounts.entries())
    .map(([author, count]) => ({
      author,
      lines: count,
      percentage: ((count / totalLines) * 100).toFixed(1) + "%",
    }))
    .sort((a, b) => b.lines - a.lines);

  return {
    file: filePath,
    lines: lines.slice(0, 200), // cap output size
    top_contributors: topContributors,
  };
}

export interface Changelog {
  title: string;
  range: string;
  generated_at: string;
  sections: Record<string, string[]>;
  raw_commits: Array<{
    hash: string;
    message: string;
    date: string;
    author: string;
  }>;
}

export async function generateChangelog(
  from?: string,
  to?: string,
  repoPath?: string
): Promise<Changelog> {
  const git = getGit(repoPath);

  const range = from && to ? `${from}..${to}` : undefined;
  const logArgs: string[] = range ? [range] : [];
  logArgs.push("--max-count=100");

  const log = await git.log(logArgs);

  // Categorize commits by conventional commit prefixes
  const sections: Record<string, string[]> = {};
  const categoryMap: Record<string, string> = {
    feat: "Features",
    fix: "Bug Fixes",
    docs: "Documentation",
    style: "Style",
    refactor: "Refactoring",
    perf: "Performance",
    test: "Tests",
    build: "Build",
    ci: "CI/CD",
    chore: "Chores",
  };

  for (const commit of log.all) {
    const match = commit.message.match(/^(\w+)(?:\(.*?\))?:\s*(.*)$/);
    let category = "Other";
    let message = commit.message;

    if (match) {
      category = categoryMap[match[1].toLowerCase()] || "Other";
      message = match[2];
    }

    if (!sections[category]) sections[category] = [];
    sections[category].push(
      `${commit.hash.substring(0, 8)} — ${message} (${commit.author_name})`
    );
  }

  return {
    title: range ? `Changelog: ${range}` : "Recent Changelog",
    range: range || `last ${log.all.length} commits`,
    generated_at: new Date().toISOString(),
    sections,
    raw_commits: log.all.map((c) => ({
      hash: c.hash.substring(0, 8),
      message: c.message,
      date: c.date,
      author: c.author_name,
    })),
  };
}

export interface BranchHealth {
  branches: Array<{
    name: string;
    is_current: boolean;
    last_commit_date: string;
    last_commit_message: string;
    last_commit_author: string;
    ahead_behind?: { ahead: number; behind: number };
    is_stale: boolean;
    is_merged: boolean;
  }>;
  stale_count: number;
  merged_count: number;
  active_count: number;
}

export async function getBranchHealth(
  repoPath?: string
): Promise<BranchHealth> {
  const git = getGit(repoPath);
  const branchSummary = await git.branch();
  const localBranches = branchSummary.all.filter(
    (b) => !b.startsWith("remotes/")
  );

  const now = Date.now();
  const STALE_DAYS = 30;

  const branches: BranchHealth["branches"] = [];

  for (const name of localBranches) {
    try {
      const log = await git.log([name, "--max-count=1"]);
      const lastCommit = log.latest;
      if (!lastCommit) continue;

      const commitDate = new Date(lastCommit.date);
      const daysSince = (now - commitDate.getTime()) / (1000 * 60 * 60 * 24);

      // Check if merged into current branch
      let isMerged = false;
      if (name !== branchSummary.current) {
        try {
          const mergedBranches = await git.raw(["branch", "--merged", branchSummary.current]);
          isMerged = mergedBranches.split("\n").some((b) => b.trim() === name);
        } catch {
          // skip
        }
      }

      // Check ahead/behind vs default remote
      let aheadBehind: { ahead: number; behind: number } | undefined;
      try {
        const ab = await git.raw([
          "rev-list",
          "--left-right",
          "--count",
          `${branchSummary.current}...${name}`,
        ]);
        const [behind, ahead] = ab.trim().split(/\s+/).map(Number);
        aheadBehind = { ahead: ahead || 0, behind: behind || 0 };
      } catch {
        // no remote tracking
      }

      branches.push({
        name,
        is_current: name === branchSummary.current,
        last_commit_date: lastCommit.date,
        last_commit_message: lastCommit.message,
        last_commit_author: lastCommit.author_name,
        ahead_behind: aheadBehind,
        is_stale: daysSince > STALE_DAYS,
        is_merged: isMerged,
      });
    } catch {
      // skip branches that can't be read
    }
  }

  return {
    branches: branches.sort(
      (a, b) =>
        new Date(b.last_commit_date).getTime() -
        new Date(a.last_commit_date).getTime()
    ),
    stale_count: branches.filter((b) => b.is_stale).length,
    merged_count: branches.filter((b) => b.is_merged).length,
    active_count: branches.filter((b) => !b.is_stale && !b.is_merged).length,
  };
}

export async function searchHistory(
  query: string,
  repoPath?: string,
  maxResults = 20
): Promise<{
  query: string;
  matches: Array<{
    hash: string;
    date: string;
    author: string;
    message: string;
    match_type: "message" | "diff";
  }>;
}> {
  const git = getGit(repoPath);
  const matches: Array<{
    hash: string;
    date: string;
    author: string;
    message: string;
    match_type: "message" | "diff";
  }> = [];

  // Search commit messages
  try {
    const msgLog = await git.log([
      "--grep",
      query,
      "-i",
      `--max-count=${maxResults}`,
    ]);
    for (const c of msgLog.all) {
      matches.push({
        hash: c.hash.substring(0, 8),
        date: c.date,
        author: c.author_name,
        message: c.message,
        match_type: "message",
      });
    }
  } catch {
    // empty
  }

  // Search diffs (pickaxe)
  if (matches.length < maxResults) {
    try {
      const raw = await git.raw([
        "log",
        `-S${query}`,
        `--max-count=${maxResults - matches.length}`,
        "--format=%H|%aI|%an|%s",
      ]);
      const existingHashes = new Set(matches.map((m) => m.hash));
      for (const line of raw.trim().split("\n").filter(Boolean)) {
        const [hash, date, author, ...msgParts] = line.split("|");
        const shortHash = hash.substring(0, 8);
        if (!existingHashes.has(shortHash)) {
          matches.push({
            hash: shortHash,
            date,
            author,
            message: msgParts.join("|"),
            match_type: "diff",
          });
        }
      }
    } catch {
      // empty
    }
  }

  return { query, matches };
}
