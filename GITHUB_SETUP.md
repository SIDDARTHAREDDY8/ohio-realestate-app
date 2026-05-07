# GitHub Actions Setup Guide

This document walks you through pushing the Ohio Real Estate Market Intelligence Platform to GitHub and enabling automatic monthly data refresh via GitHub Actions.

---

## Overview of What Gets Automated

Once set up, GitHub Actions will run **every 1st of the month at 06:00 UTC** and:

1. Re-fetch fresh data from the US Census Bureau ACS API
2. Re-download the latest Redfin market tracker data
3. Pull updated FRED economic indicators (mortgage rates, HPI, unemployment, etc.)
4. Run the full ETL pipeline → DuckDB warehouse
5. Re-train all 4 ML models on the latest data
6. Export fresh JSON files to `client/src/data/`
7. Commit and push the updated data back to your repo
8. Post a summary table of key Ohio metrics to the Actions run log

You can also trigger a refresh manually at any time from the GitHub Actions tab.

---

## Step 1 — Export the Project from Manus

In the Manus Management UI, click **Code** → **Download all files** (or use the ⋯ menu → Download as ZIP). This gives you the complete project including the `pipeline/` directory and `.github/workflows/`.

Alternatively, export directly to GitHub: **Settings** → **GitHub** → connect your account and create a new repo.

---

## Step 2 — Create a GitHub Repository

```bash
# After downloading/cloning, initialize git if not already done
cd ohio-realestate-app
git init
git add .
git commit -m "feat: initial commit — Ohio RE Market Intelligence Platform"

# Create a new repo on GitHub (via UI or gh CLI)
gh repo create ohio-re-intelligence --public --source=. --push

# Or with standard git remote
git remote add origin https://github.com/YOUR_USERNAME/ohio-re-intelligence.git
git branch -M main
git push -u origin main
```

---

## Step 3 — Verify Workflows Are Detected

After pushing, go to your GitHub repo → **Actions** tab. You should see two workflows:

| Workflow | File | Trigger |
|----------|------|---------|
| **Monthly Data Refresh** | `.github/workflows/refresh-data.yml` | 1st of month, 06:00 UTC + manual |
| **CI — Build & Type Check** | `.github/workflows/ci.yml` | Every push to `main` |

If the workflows don't appear, ensure the `.github/` directory was committed (it may be hidden on some systems — use `git add .github/` explicitly).

---

## Step 4 — Run Your First Manual Refresh

Don't wait until the 1st of the month. Trigger a run immediately:

1. Go to **Actions** → **Monthly Data Refresh**
2. Click **Run workflow** (top right)
3. Leave defaults or check **Skip Redfin download** for a faster first run (~5 min vs ~30 min)
4. Click the green **Run workflow** button

The workflow will:
- Install Python 3.11 and all dependencies from `pipeline/requirements.txt`
- Run the full pipeline (Census → Redfin → FRED → ETL → ML → Export)
- Commit updated JSON files back to `main`
- Show a summary table in the run log

---

## Step 5 — Verify the Data Was Updated

After the workflow completes, check:

```bash
git pull origin main
cat client/src/data/pipeline_meta.json
# → {"last_refresh": "2026-06-01T06:12:34+00:00", ...}
```

The `pipeline_meta.json` file is updated on every run and shows the exact UTC timestamp of the last refresh.

---

## Workflow Details

### `refresh-data.yml` — Monthly Data Refresh

```
Schedule:  cron "0 6 1 * *"  (1st of every month, 06:00 UTC)
Runner:    ubuntu-latest
Timeout:   90 minutes
```

**Key steps:**

| Step | What it does |
|------|-------------|
| Checkout | Fetches the latest `main` branch |
| Cache raw data | Caches `pipeline/data/raw/` between runs to avoid re-downloading Redfin every month if unchanged |
| Run pipeline | Executes `python pipeline/run_pipeline.py` |
| Verify output | Prints record counts for all 10 JSON files |
| Commit data | Commits changed JSON files with message `data: auto-refresh YYYY-MM-DD HH:MM UTC [skip ci]` |
| Upload log | Saves `pipeline/pipeline.log` as a downloadable artifact (kept 30 days) |
| Job summary | Posts a KPI table to the Actions run summary page |

### `ci.yml` — Build Validation

Runs on every push to `main` (except data-only commits, which include `[skip ci]`):

| Step | What it does |
|------|-------------|
| TypeScript check | `pnpm exec tsc --noEmit` — catches type errors before deploy |
| Build | `pnpm build` — ensures the app compiles successfully |
| Lint pipeline | `ruff check pipeline/` — Python style check |
| Validate JSON | Verifies all 10 data files parse as valid JSON |

---

## Manual Trigger Options

The `refresh-data.yml` workflow exposes two optional inputs when triggered manually:

| Input | Default | Description |
|-------|---------|-------------|
| `skip_redfin` | `false` | Skip the Redfin download (saves ~20 min, uses cached data) |
| `skip_models` | `false` | Skip ML model re-training (saves ~5 min) |

Use `skip_redfin=true` for quick FRED/Census-only refreshes between months.

---

## Caching Strategy

The workflow caches `pipeline/data/raw/` between runs using `actions/cache@v4`. The cache key includes the run ID, so:

- **First run**: Downloads everything fresh (~30 min for Redfin)
- **Subsequent runs**: Restores the previous raw data, only re-fetches what changed
- **Monthly schedule**: The cache is restored from the most recent run, so Redfin is only re-downloaded when the cache expires (7 days by default on GitHub-hosted runners)

---

## Connecting to Manus Deployment

After the Actions workflow commits updated data to `main`, you have two options to get the live site updated:

**Option A — Manual publish** (simplest): After the Actions run commits new data, go to the Manus Management UI and click **Publish**. The new JSON files are already in the repo.

**Option B — Automatic Manus redeploy**: If Manus supports webhook-triggered redeploys in the future, you can add a final step to the workflow that calls the Manus deploy API.

For now, Option A is the recommended approach: the data refreshes automatically every month, and you publish to production when you're ready.

---

## Troubleshooting

**Workflow not appearing in Actions tab**
Make sure `.github/` was committed. Run `git add .github/ && git commit -m "ci: add GitHub Actions workflows"`.

**Pipeline fails on Redfin download**
The Redfin file is ~1.5 GB compressed. GitHub-hosted runners have a 90-minute timeout. If it times out, use the manual trigger with `skip_redfin=true` and the cached data will be used.

**`No data changes detected — skipping commit`**
This is normal if the upstream sources haven't published new data yet (e.g., Census ACS only updates annually). The workflow still runs successfully; it just doesn't create a new commit.

**Python dependency errors**
Update `pipeline/requirements.txt` with the specific version that works, then push and re-run.

---

## Repository Structure After Setup

```
ohio-realestate-app/
├── .github/
│   └── workflows/
│       ├── refresh-data.yml   ← Monthly auto-refresh
│       └── ci.yml             ← Build validation on push
├── client/
│   └── src/
│       └── data/              ← Auto-updated JSON files (committed by Actions)
│           ├── county_summary.json
│           ├── economic_indicators.json
│           ├── redfin_county_market.json
│           ├── hpi_forecast.json
│           ├── kpis.json
│           └── pipeline_meta.json   ← Last refresh timestamp
├── pipeline/
│   ├── run_pipeline.py        ← Main orchestrator
│   ├── requirements.txt       ← Python deps for Actions
│   ├── scripts/               ← Data acquisition scripts
│   └── src/
│       ├── etl/               ← DuckDB ETL pipeline
│       └── models/            ← ML training scripts
└── [React frontend files]
```

---

## What to Say in Interviews

When asked about this project, you can accurately say:

> "The platform uses GitHub Actions for automated DataOps — a scheduled workflow runs on the 1st of every month, re-fetches data from three public APIs (Census Bureau, Redfin S3, FRED), runs the ETL pipeline into a DuckDB star schema, re-trains four ML models, and commits the refreshed JSON data back to the repository. The CI workflow validates TypeScript types and the production build on every push."

This demonstrates knowledge of: scheduled pipelines, CI/CD, data freshness management, and the full data engineering lifecycle.
