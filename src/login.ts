import { createInterface } from "readline";
import { platform } from "os";
import chalk from "chalk";
import { isGhInstalled, runGhAuthLogin } from "./github";
import { getExeca } from "./execaLoader";

const GH_INSTALL_URL = "https://cli.github.com/";

function question(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve((answer ?? "").trim().toLowerCase());
    });
  });
}

/**
 * Ask user: "GitHub CLI (gh) is required. Do you want to install it? (y/n)"
 * Returns true for y/yes, false for n/no or empty.
 */
export async function promptInstallGh(noColor: boolean): Promise<boolean> {
  const msg =
    "GitHub CLI (gh) is required. Do you want to install it? (y/n): ";
  const out = noColor ? msg : chalk.yellow(msg);
  const answer = await question(out);
  return answer === "y" || answer === "yes";
}

/**
 * Try to install gh or open the install page. Uses platform-appropriate package managers.
 */
export async function installOrOpenGh(noColor: boolean): Promise<void> {
  const plat = platform();
  const log = (s: string) => (noColor ? console.log(s) : console.log(chalk.blue(s)));

  if (plat === "win32") {
    const winInstallers: { name: string; args: string[] }[] = [
      {
        name: "winget",
        args: [
          "install",
          "--id",
          "GitHub.cli",
          "-e",
          "--silent",
          "--accept-package-agreements",
          "--accept-source-agreements",
        ],
      },
      { name: "scoop", args: ["install", "gh"] },
      { name: "choco", args: ["install", "gh", "-y"] },
    ];
    const execa = await getExeca();
    for (const { name, args } of winInstallers) {
      try {
        const cmd = name === "winget" ? "winget" : name === "scoop" ? "scoop" : "choco";
        log(`Trying to install GitHub CLI via ${name}...`);
        await execa(cmd, args, { stdio: "inherit" });
        log("Installation started or completed. If a new terminal is required, open one and run pr-check again.");
        return;
      } catch {
        continue;
      }
    }
    log("No package manager found (winget, scoop, or choco). Opening install page in browser...");
    await openUrl(GH_INSTALL_URL);
    console.log(`Install from: ${GH_INSTALL_URL}`);
    console.log("After installing, run pr-check again.");
    return;
  }

  if (plat === "darwin") {
    const execa = await getExeca();
    try {
      log("Installing GitHub CLI via Homebrew...");
      await execa("brew", ["install", "gh"], { stdio: "inherit" });
      return;
    } catch {
      log("Homebrew failed or not installed. Opening install page...");
      await openUrl(GH_INSTALL_URL);
      console.log(`Install from: ${GH_INSTALL_URL}`);
      console.log("After installing, run pr-check again.");
      return;
    }
  }

  if (plat === "linux") {
    const execa = await getExeca();
    try {
      log("Trying to install GitHub CLI via apt...");
      await execa("sudo", ["apt-get", "update", "-qq"], { reject: false });
      await execa("sudo", ["apt-get", "install", "-y", "gh"], { stdio: "inherit" });
      return;
    } catch {
      try {
        log("Trying to install GitHub CLI via dnf...");
        await execa("sudo", ["dnf", "install", "-y", "gh"], { stdio: "inherit" });
        return;
      } catch {
        // fall through to open URL
      }
    }
  }

  log("Opening GitHub CLI install page in browser...");
  await openUrl(GH_INSTALL_URL);
  console.log(`Install from: ${GH_INSTALL_URL}`);
  console.log("After installing, run pr-check again.");
}

async function openUrl(url: string): Promise<void> {
  const execa = await getExeca();
  const plat = platform();
  const cmd = plat === "win32" ? "cmd" : plat === "darwin" ? "open" : "xdg-open";
  const args = plat === "win32" ? ["/c", "start", "", url] : [url];
  return execa(cmd, args).then(() => undefined).catch(() => undefined);
}

/**
 * Full login flow: check gh -> if missing, prompt to install -> install or open URL -> run gh auth login.
 */
export async function runLoginFlow(noColor: boolean): Promise<number> {
  if (await isGhInstalled()) {
    try {
      await runGhAuthLogin();
      if (!noColor) console.log(chalk.green("Login complete. You can now run pr-check."));
      return 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(noColor ? msg : chalk.red(msg));
      return 1;
    }
  }

  console.log(noColor ? "GitHub CLI (gh) is not installed." : chalk.yellow("GitHub CLI (gh) is not installed."));
  const wantInstall = await promptInstallGh(noColor);
  if (!wantInstall) {
    console.log(noColor ? "Skipped. Install gh from https://cli.github.com/ and run pr-check login." : chalk.dim("Skipped. Install gh from https://cli.github.com/ and run pr-check login."));
    return 0;
  }

  await installOrOpenGh(noColor);

  if (await isGhInstalled()) {
    try {
      await runGhAuthLogin();
      if (!noColor) console.log(chalk.green("Login complete."));
      return 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(noColor ? msg : chalk.red(msg));
      return 1;
    }
  }

  console.log(noColor
    ? "After installing gh, run: pr-check login"
    : chalk.dim("After installing gh, run: pr-check login"));
  return 0;
}
