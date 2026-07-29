# AI-Powered CRM Dashboard

A full-stack CRM dashboard for IT services sales teams. Built with React + TypeScript + Vite frontend, FastAPI backend, SQLAlchemy models, RBAC-protected CRM workflows, dashboard analytics, lead scoring, email drafting, meeting summaries, reports, notifications, and an AI assistant.

---

## 🌟 Demo Credentials

| Email | Password | Role |
|---|---|---|
| `admin@crm.com` | `Admin123!` | Admin |
| `manager@crm.com` | `Manager123!` | Manager |
| `exec@crm.com` | `Exec123!` | Executive |

---

## 💻 Local Development

### Quick Start (Windows)
```bat
start.bat
```

Or start separately:
- Backend: `start_backend.bat`
- Frontend: `start_frontend.bat`

### Endpoints
- **Frontend**: http://localhost:5173
- **Backend API**: http://127.0.0.1:8000
- **OpenAPI Docs**: http://127.0.0.1:8000/docs

---

## 🚀 100% Free Production Deployment Guide

You can host this entire full-stack app **100% FREE forever** using Vercel, Render/Koyeb, and Supabase.

### 1. Database (Supabase PostgreSQL - 100% Free)
1. Sign up at [supabase.com](https://supabase.com).
2. Create a new PostgreSQL project.
3. Copy your connection string from **Project Settings → Database → URI**:
   `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`

### 2. Backend (Render / Koyeb Free Web Service - 100% Free)
1. Sign up at [render.com](https://render.com) or [koyeb.com](https://koyeb.com).
2. Create a **Web Service** linked to your GitHub repo.
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment Variables:
   - `DATABASE_URL` = *(Your Supabase connection string)*
   - `SECRET_KEY` = *(Secure random string)*
   - `BACKEND_CORS_ORIGINS` = `["*"]`
   - `GEMINI_API_KEY` = *(Optional)*

### 3. Frontend (Vercel - 100% Free)
1. Sign up at [vercel.com](https://vercel.com).
2. Import your GitHub repository.
3. Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Environment Variable:
   - `VITE_API_BASE_URL` = `https://your-backend.onrender.com`
5. Click **Deploy**.

---

## 🐳 Local Docker Support

```bash
docker-compose up --build
```
Runs local PostgreSQL, Redis, FastAPI, and Vite dev server.