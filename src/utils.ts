import type { PRRecord, PRCategory } from "./types";

const CATEGORY_PRIORITY: Record<PRCategory, number> = {
  review: 3,
  assigned: 2,
  authored: 1,
};

/**
 * Return human-readable time ago from ISO date string or unix timestamp.
 */
export function timeAgo(createdAt: string | number): string {
  const now = Date.now();
  const then =
    typeof createdAt === "string"
      ? new Date(createdAt).getTime()
      : createdAt * 1000;
  const diffMs = Math.max(0, now - then);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  if (diffMin >= 60) return "1 hour";
  return "< 1 hour";
}

/**
 * Dedupe PRs by URL; when a PR appears in multiple lists, keep the highest-priority category
 * (review > assigned > authored).
 */
export function dedupePrs(prs: PRRecord[]): PRRecord[] {
  const byUrl = new Map<string, PRRecord>();
  for (const pr of prs) {
    const existing = byUrl.get(pr.url);
    if (
      !existing ||
      CATEGORY_PRIORITY[pr.category] > CATEGORY_PRIORITY[existing.category]
    ) {
      byUrl.set(pr.url, pr);
    }
  }
  return Array.from(byUrl.values());
}

/**
 * Build GitHub search query string: baseQuery + optional org: + optional repo: terms.
 * Limit is applied at call site (gh search prs --limit).
 */
export function buildSearchQuery(opts: {
  baseQuery: string;
  org?: string;
  repos?: string[];
}): string {
  const parts = [opts.baseQuery.trim()];
  if (opts.org) {
    parts.push(`org:${opts.org}`);
  }
  if (opts.repos && opts.repos.length > 0) {
    for (const r of opts.repos) {
      parts.push(`repo:${r}`);
    }
  }
  return parts.join(" ");
}
