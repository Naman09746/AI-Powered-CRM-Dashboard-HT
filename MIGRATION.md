# Migration Guide — HT Cold Outreach → Full-Stack CRM

This repo previously contained a single-folder script collection under `HT COLD OUTREACH/` (`app.py`, `outreach_agent.py`, `prospect_scraper.py`, `sheets_reader.py`, etc.). The canonical codebase is now the monorepo at the repo root:

| Legacy (`HT COLD OUTREACH/`) | New (`backend/` / `frontend/`) |
|---|---|
| `app.py` (FastAPI monolith) | `backend/app/main.py` + `backend/app/routers/*` |
| `database.py` (SQLite flat) | `backend/app/models/crm.py` + `user.py` + `alembic/` |
| `outreach_agent.py` (4-phase prompt) | `backend/app/services/outreach_service.py` |
| `email_sender.py` | `backend/app/services/email_service.py` |
| `prospect_scraper.py` | `backend/app/seed_synthetic_data.py` + `backend/seeds/sample_prospects.csv` |
| `templates/dashboard.html` | `frontend/src/pages/Dashboard.tsx` + `Outreach.tsx` |
| `test_pipeline.py` | `backend/tests/` |
| `requirements.txt` | `backend/requirements.txt` + `frontend/package.json` |

## Legacy Archive
The `HT COLD OUTREACH/` folder is preserved on branch `legacy/ht-scripts` and will be removed from `main` to avoid 50 MB duplication (`prospects_dataset.csv` ×2) and confusion for contributors. To access legacy scripts:

```bash
git fetch origin legacy/ht-scripts
git checkout legacy/ht-scripts -- "HT COLD OUTREACH/"
```

## Running the New Stack

```bash
# via docker-compose (recommended — includes alembic migrations)
docker-compose up --build

# local without docker (SQLite fallback)
cd backend && alembic upgrade head && uvicorn app.main:app --reload --port 8000
cd frontend && npm ci && npm run dev
```

Seed data is now idempotent at `backend/app/main.py:241 startup_event` — it no longer drops tables on schema errors (previous `check_and_fix_outreach_tables` removed). Migrations are applied via `backend/entrypoint.sh` (`alembic upgrade head`).

## Environment

| Variable | New Location | Notes |
|---|---|---|
| `DATABASE_URL` | `backend/app/core/config.py:10` | `postgresql://...` prod, `sqlite:///./crm_local.db` local |
| `SECRET_KEY` | `backend/app/core/config.py:7` | must be set in prod; default only for dev |
| `GEMINI_API_KEY/MODEL` | `backend/app/core/config.py:14` | `gemini-2.0-flash` |
| `REDIS_URL` | `docker-compose.yml:22` | used for future `OutreachJob` queue |
| `ML_EAGER_TRAIN` | `backend/app/main.py:255` | set `=1` to train on startup; default lazy on first `predict_score` |

## Breaking Changes
- `POST /outreach/process-batch` now async by default (returns `202` with `job_id` in `result_ids`). Use `?sync=true` for synchronous behavior (tests).
- `GET /outreach/jobs` + `GET /outreach/jobs/{id}` added for polling batch progress.
- `GET /dashboard/kpis` now under `/api/v1/dashboard/kpis` (scoped by role).

## For Contributors
- Keep legacy scripts untouched — PRs targeting `HT COLD OUTREACH/` will be closed.
- Add new prospects via `POST /api/v1/outreach/prospects/import` CSV or UI, not direct CSV commit.
- Run `pytest backend/tests -v` and `alembic upgrade head` before PR.
