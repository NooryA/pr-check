import chalk from "chalk";
import type { PRRecord, GroupedResults } from "./types";
import { timeAgo } from "./utils";

function ageDays(createdAt: string): number {
  const then = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (24 * 60 * 60 * 1000));
}

function isStale(createdAt: string, staleDays: number): boolean {
  return ageDays(createdAt) >= staleDays;
}

export function formatPrLine(
  pr: PRRecord,
  options: { staleDays: number; noColor: boolean }
): string {
  const age = timeAgo(pr.createdAt);
  const stale = isStale(pr.createdAt, options.staleDays);
  const dim = options.noColor ? (s: string) => s : chalk.dim;
  const yellow = options.noColor ? (s: string) => s : chalk.yellow;
  const gray = options.noColor ? (s: string) => s : chalk.gray;

  const lines: string[] = [];
  const title = pr.isDraft ? `[Draft] ${pr.title}` : pr.title;
  lines.push(`  ${title}`);
  lines.push(
    dim(`    ${pr.repo} #${pr.number} · by @${pr.authorLogin} · open ${age}`) +
      (stale ? ` ${yellow(" STALE")}` : "")
  );
  lines.push(gray(`    ${pr.url}`));
  return lines.join("\n");
}

export function formatSection(
  title: string,
  emoji: string,
  prs: PRRecord[],
  options: { staleDays: number; noColor: boolean }
): string {
  if (prs.length === 0) return "";
  const header = `${emoji} ${title} (${prs.length})`;
  const bold = options.noColor ? (s: string) => s : chalk.bold;
  const sections = [bold(header), ...prs.map((pr) => formatPrLine(pr, options))];
  return sections.join("\n");
}

export function formatHuman(
  results: GroupedResults,
  options: { staleDays: number; noColor: boolean }
): string {
  const total =
    results.awaitingReview.length +
    results.assignedToYou.length +
    results.yourOpenPRs.length;

  if (total === 0) {
    const green = options.noColor ? (s: string) => s : chalk.green;
    return green("All clear — no PR responsibilities right now.");
  }

  const parts: string[] = [];
  parts.push(
    formatSection(
      "Awaiting Your Review",
      "👀",
      results.awaitingReview,
      options
    )
  );
  parts.push(
    formatSection("Assigned to You", "📌", results.assignedToYou, options)
  );
  parts.push(
    formatSection(
      "Your Open PRs Waiting on Review",
      "📝",
      results.yourOpenPRs,
      options
    )
  );

  const nonEmpty = parts.filter(Boolean);
  const bold = options.noColor ? (s: string) => s : chalk.bold;
  nonEmpty.push(
    bold(`\nTotal responsibility: ${results.totalResponsibilityCount}`)
  );
  return nonEmpty.join("\n\n");
}

export function formatJson(
  results: GroupedResults,
  staleDays: number
): string {
  const serializePr = (pr: PRRecord) => ({
    ...pr,
    ageDays: ageDays(pr.createdAt),
    isStale: isStale(pr.createdAt, staleDays),
  });
  const out = {
    awaitingReview: results.awaitingReview.map(serializePr),
    assignedToYou: results.assignedToYou.map(serializePr),
    yourOpenPRs: results.yourOpenPRs.map(serializePr),
    totalResponsibilityCount: results.totalResponsibilityCount,
  };
  return JSON.stringify(out, null, 2);
}

export function formatError(message: string, noColor: boolean): string {
  return noColor ? message : chalk.red(message);
}
