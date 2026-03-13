import type { PRRecord, PRCategory, GroupedResults, PrCheckOptions } from "./types";
import { dedupePrs } from "./utils";
import { getExeca } from "./execaLoader";

export const GH_NOT_FOUND =
  "pr-check requires GitHub CLI (gh). Install: https://cli.github.com/ — then run: gh auth login.";
export const GH_NOT_AUTHED =
  "pr-check requires GitHub CLI (gh). If not logged in, run: gh auth login.";

/**
 * Returns true if the GitHub CLI (gh) is installed and on PATH.
 * On Windows, a missing command often does not set ENOENT, so any failure is treated as not installed.
 */
export async function isGhInstalled(): Promise<boolean> {
  try {
    const execa = await getExeca();
    const result = await execa("gh", ["--version"], { reject: false });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Run `gh auth login` with inherited stdio so the user can interact.
 */
export async function runGhAuthLogin(): Promise<void> {
  const execa = await getExeca();
  await execa("gh", ["auth", "login"], { stdio: "inherit" });
}

export async function ensureGhAuth(): Promise<void> {
  const execa = await getExeca();
  try {
    await execa("gh", ["auth", "status"]);
  } catch (err) {
    const execaErr = err as { exitCode?: number; message?: string; code?: string };
    if (execaErr.code === "ENOENT" || execaErr.message?.includes("not found")) {
      throw new Error(GH_NOT_FOUND);
    }
    if (
      execaErr.exitCode !== 0 ||
      execaErr.message?.includes("not logged in") ||
      execaErr.message?.includes("authentication")
    ) {
      throw new Error(GH_NOT_AUTHED);
    }
    throw err;
  }
}

export async function getCurrentUserLogin(): Promise<string> {
  const execa = await getExeca();
  const { stdout } = await execa("gh", ["api", "user", "--jq", ".login"]);
  const login = (stdout ?? "").trim();
  if (!login) {
    throw new Error(GH_NOT_AUTHED);
  }
  return login;
}

interface GhSearchPrItem {
  repository?: { nameWithOwner?: string; owner?: { login?: string }; name?: string };
  number: number;
  title: string;
  url: string;
  author?: { login?: string } | null;
  createdAt: string;
  isDraft: boolean;
}

function repoSlug(item: GhSearchPrItem): string {
  const r = item.repository;
  if (!r) return "unknown/unknown";
  if (r.nameWithOwner) return r.nameWithOwner;
  const owner = r.owner?.login ?? "unknown";
  const name = r.name ?? "unknown";
  return `${owner}/${name}`;
}

function authorLogin(item: GhSearchPrItem): string {
  return item.author?.login ?? "unknown";
}

/**
 * Validate that each repo exists (404 or API error = invalid). Throws with invalid list if any.
 */
export async function validateRepos(repos: string[]): Promise<void> {
  if (repos.length === 0) return;
  const invalid: string[] = [];
  const execa = await getExeca();
  await Promise.all(
    repos.map(async (repo) => {
      const result = await execa("gh", ["api", `/repos/${repo}`], { reject: false });
      if (result.exitCode !== 0 || !result.stdout?.trim()) {
        invalid.push(repo);
      }
    })
  );
  if (invalid.length > 0) {
    throw new Error(
      `Repository not found or no access: ${invalid.join(", ")}. Check spelling and that the repo exists.`
    );
  }
}

/**
 * Run gh search prs and return parsed PR list.
 * Uses only CLI flags (no query string) so behaviour matches the manual:
 *   gh search prs --review-requested=@me --state=open --repo=owner/repo
 */
export async function searchPrs(
  limit: number,
  flags: {
    reviewRequested?: string;
    assignee?: string;
    author?: string;
    repo?: string[];
    owner?: string;
  }
): Promise<GhSearchPrItem[]> {
  const args: string[] = ["search", "prs", "--state=open", "--limit", String(limit)];
  if (flags.reviewRequested) {
    args.push(`--review-requested=${flags.reviewRequested}`);
  }
  if (flags.assignee) {
    args.push(`--assignee=${flags.assignee}`);
  }
  if (flags.author) {
    args.push(`--author=${flags.author}`);
  }
  if (flags.owner) {
    args.push(`--owner=${flags.owner}`);
  }
  if (flags.repo?.length) {
    for (const r of flags.repo) {
      args.push(`--repo=${r}`);
    }
  }
  args.push("--json", "repository,number,title,url,author,createdAt,isDraft");
  const execa = await getExeca();
  try {
    const { stdout } = await execa("gh", args);
    const raw = (stdout ?? "").trim();
    if (!raw) return [];
    const data = JSON.parse(raw) as
      | GhSearchPrItem[]
      | { message?: string; documentation_url?: string };
    if (Array.isArray(data)) {
      return data;
    }
    const msg = (data as { message?: string }).message ?? "Unknown API error";
    if (msg.includes("rate limit") || msg.includes("403")) {
      throw new Error("GitHub rate limit exceeded. Try: gh auth refresh or wait a few minutes.");
    }
    throw new Error(msg);
  } catch (err) {
    const execaErr = err as { stderr?: string; message?: string; code?: string };
    if (execaErr.code === "ENOENT") {
      throw new Error(GH_NOT_FOUND);
    }
    if (execaErr.stderr?.includes("rate limit")) {
      throw new Error("GitHub rate limit exceeded. Try: gh auth refresh or wait a few minutes.");
    }
    throw err;
  }
}

function mapToRecord(item: GhSearchPrItem, category: PRCategory): PRRecord {
  return {
    repo: repoSlug(item),
    number: item.number,
    title: item.title,
    url: item.url,
    authorLogin: authorLogin(item),
    createdAt: item.createdAt,
    isDraft: item.isDraft ?? false,
    reviewDecision: null,
    hasRequestedReviewers: category === "review",
    category,
  };
}

export async function fetchPrs(_login: string, options: PrCheckOptions): Promise<GroupedResults> {
  if (options.repos && options.repos.length > 0) {
    await validateRepos(options.repos);
  }

  const limit = options.limitPerCategory;
  const baseFlags = {
    repo: options.repos,
    owner: options.org,
  };
  const categories: PRCategory[] = ["review", "assigned", "authored"];
  const searchFlags = [
    { ...baseFlags, reviewRequested: "@me" },
    { ...baseFlags, assignee: "@me" },
    { ...baseFlags, author: "@me" },
  ] as const;

  const results = await Promise.all(
    searchFlags.map((flags, i) =>
      searchPrs(limit, flags).then((items) => items.map((item) => mapToRecord(item, categories[i])))
    )
  );

  const reviewList = results[0];
  const assignedList = results[1];
  const authoredList = results[2];

  const allTagged = [...reviewList, ...assignedList, ...authoredList];
  const deduped = dedupePrs(allTagged);

  const awaitingReview: PRRecord[] = [];
  const assignedToYou: PRRecord[] = [];
  const yourOpenPRs: PRRecord[] = [];

  for (const pr of deduped) {
    switch (pr.category) {
      case "review":
        awaitingReview.push(pr);
        break;
      case "assigned":
        assignedToYou.push(pr);
        break;
      case "authored":
        yourOpenPRs.push(pr);
        break;
    }
  }

  const totalResponsibilityCount = awaitingReview.length + assignedToYou.length;

  return {
    awaitingReview,
    assignedToYou,
    yourOpenPRs,
    totalResponsibilityCount,
  };
}
