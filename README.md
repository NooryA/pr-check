# pr-check

Show your GitHub Pull Request responsibilities in one command: PRs awaiting your review, assigned to you, and your open PRs waiting on others.

## What it does

When you run `pr-check`, it:

1. **Awaiting Your Review** — Open PRs where you are requested as a reviewer
2. **Assigned to You** — Open PRs assigned to you
3. **Your Open PRs Waiting on Review** — PRs you authored that are still open

Each PR shows repo, number, title, URL, author, and how long it has been open. PRs older than a threshold are marked as STALE.

## Install

```bash
npm install -g "@noor.ahamed/pr-check"
```

## Requirements

- **Node.js** 18 or later
- **GitHub CLI (`gh`)** — used for authentication and API access. You do **not** need to install it or log in beforehand: when you run `pr-check`, it checks for `gh` and your login status and guides you through setup if needed (install + sign-in).

No personal access token or manual config is required.

## Usage

```bash
pr-check
```

To log in to your Github:

```bash
pr-check login
```

### Options

| Option           | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `--no-color`     | Disable colored output                                        |
| `--json`         | Output JSON for scripting                                     |
| `--stale <days>` | Mark PRs older than N days as STALE (default: 3)              |
| `--limit <n>`    | Max results per category (default: 20)                        |
| `--org <org>`    | Only show PRs in this GitHub organization                     |
| `--repos <csv>`  | Only show PRs in these repos (e.g. `owner/repo1,owner/repo2`) |
| `--quiet`        | Only print counts; use exit code to indicate responsibility   |

### Examples

```bash
# Default: human-readable output (installs gh and runs login if needed)
pr-check

# Explicitly log in or install gh (no PR fetch)
pr-check login

# JSON output for scripts
pr-check --json

# Stale threshold 5 days, max 10 per section
pr-check --stale 5 --limit 10

# Only PRs in a specific org
pr-check --org mycompany

# Only PRs in specific repos
pr-check --repos owner1/repoA,owner2/repoB

# No colors (e.g. in CI logs)
pr-check --no-color

# Quiet: only counts and exit code
pr-check --quiet
```

### Example output (default)

```
👀 Awaiting Your Review (2)

  [Draft] Add new API
    acme/backend #42 · by @alice · open 1 day
    https://github.com/acme/backend/pull/42

  Fix login bug
    acme/web #101 · by @bob · open 5 days STALE
    https://github.com/acme/web/pull/101

📌 Assigned to You (0)

📝 Your Open PRs Waiting on Review (1)

  Bump deps
    acme/lib #7 · by @you · open 2 hours
    https://github.com/acme/lib/pull/7

Total responsibility: 2
```

### Example JSON output

```json
{
  "awaitingReview": [
    {
      "repo": "acme/backend",
      "number": 42,
      "title": "Add new API",
      "url": "https://github.com/acme/backend/pull/42",
      "authorLogin": "alice",
      "createdAt": "2025-02-20T10:00:00Z",
      "isDraft": true,
      "reviewDecision": null,
      "hasRequestedReviewers": true,
      "category": "review",
      "ageDays": 1,
      "isStale": false
    }
  ],
  "assignedToYou": [],
  "yourOpenPRs": [],
  "totalResponsibilityCount": 1
}
```

## Exit codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| `0`  | Success; with `--quiet`: no PRs awaiting your review or assigned to you      |
| `1`  | Error (e.g. install/login was skipped or failed, network or rate limit)      |
| `2`  | Only with `--quiet`: at least one PR awaiting your review or assigned to you |

Use `--quiet` in scripts or CI to check responsibility without parsing output:

```bash
pr-check --quiet
echo "Exit code: $?"
```

## Troubleshooting

- **pr-check says GitHub CLI is required and asks to install**  
  Answer **y** to have pr-check install `gh` (via winget/scoop/choco on Windows, brew on macOS, apt/dnf on Linux). If you said **n** or install failed, run `pr-check` again and choose **y**, or install from [cli.github.com](https://cli.github.com/) and run `pr-check` again.

- **After installing `gh`, pr-check still says it’s not installed**  
  On Windows, the PATH may not include `gh` until you open a **new terminal**. Close and reopen your terminal, then run `pr-check` again.

- **Rate limit exceeded**  
  Wait a few minutes or run `gh auth refresh`. Authenticated users have higher limits.

- **No PRs shown**  
  Ensure you have open PRs that match (review requested, assigned, or authored by you). Use `--org` or `--repos` only if you intend to filter.
