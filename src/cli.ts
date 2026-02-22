#!/usr/bin/env node

import { createCommand } from "commander";
import ora from "ora";
import chalk from "chalk";
import pkg from "../package.json";
import type { PrCheckOptions } from "./types";
import {
  ensureGhAuth,
  getCurrentUserLogin,
  fetchPrs,
  GH_NOT_FOUND,
  GH_NOT_AUTHED,
} from "./github";
import { formatHuman, formatJson, formatError } from "./format";
import { runLoginFlow } from "./login";

function isAuthError(msg: string): boolean {
  return msg === GH_NOT_FOUND || msg === GH_NOT_AUTHED;
}

function parseRepos(csv: string | undefined): string[] {
  if (!csv || !csv.trim()) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runPrCheck(options: PrCheckOptions): Promise<number> {
  const run = async (): Promise<number> => {
    await ensureGhAuth();
    const login = await getCurrentUserLogin();

    const jsonOrQuiet = options.json || options.quiet;
    const spinner = jsonOrQuiet ? null : ora("Fetching PRs...").start();

    const results = await fetchPrs(login, options);

    if (spinner) spinner.succeed("Done");

    if (options.quiet) {
      const a = results.awaitingReview.length;
      const b = results.assignedToYou.length;
      const c = results.yourOpenPRs.length;
      console.log(`review: ${a} assigned: ${b} open: ${c}`);
      return results.totalResponsibilityCount > 0 ? 2 : 0;
    }

    if (options.json) {
      console.log(formatJson(results, options.staleDays));
      return 0;
    }

    console.log(formatHuman(results, { staleDays: options.staleDays, noColor: options.noColor }));
    return 0;
  };

  try {
    return await run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isAuthError(msg)) {
      console.error(formatError(msg, options.noColor));
      return 1;
    }
    const log = options.noColor ? (s: string) => console.log(s) : (s: string) => console.log(chalk.blue(s));
    log("GitHub CLI (gh) is required and you need to be logged in. Running login flow...");
    await runLoginFlow(options.noColor);
    try {
      return await run();
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error(formatError(retryMsg, options.noColor));
      return 1;
    }
  }
}

async function main(): Promise<number> {
  const program = createCommand();

  program
    .name("pr-check")
    .description("Show your GitHub Pull Request responsibilities in one command")
    .version((pkg as { version?: string }).version ?? "1.0.0")
    .option("--no-color", "Disable colored output")
    .option("--json", "Output JSON for scripting")
    .option("--stale <days>", "Highlight PRs older than N days as STALE", "3")
    .option("--limit <n>", "Max results per category", "20")
    .option("--org <org>", "Only show PRs in this GitHub org")
    .option("--repos <csv>", "Only show PRs in these repos (e.g. owner/repo1,owner/repo2)")
    .option("--quiet", "Only print counts and exit with code 0/2/1");

  program
    .command("login")
    .description("Log in to GitHub via GitHub CLI (gh). Prompts to install gh if not found.")
    .action(async () => {
      const parentOpts = program.opts() as Record<string, unknown>;
      const noColor = (parentOpts.noColor as boolean) ?? false;
      if (noColor) chalk.level = 0;
      const code = await runLoginFlow(noColor);
      process.exit(code);
    });

  program.action(async () => {
    const opts = program.opts() as Record<string, unknown>;
    const noColor = (opts.noColor as boolean) ?? false;
    if (noColor) chalk.level = 0;

    const staleDays = Math.max(0, parseInt(String(opts.stale ?? "3"), 10) || 3);
    const limit = Math.max(1, Math.min(100, parseInt(String(opts.limit ?? "20"), 10) || 20));
    const options: PrCheckOptions = {
      staleDays,
      limitPerCategory: limit,
      org: opts.org as string | undefined,
      repos: parseRepos(opts.repos as string | undefined),
      noColor,
      json: (opts.json as boolean) ?? false,
      quiet: (opts.quiet as boolean) ?? false,
    };

    const code = await runPrCheck(options);
    process.exit(code);
  });

  await program.parseAsync();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(() => process.exit(1));
