Write-Host "=== Deploying AI-Powered CRM Dashboard to Google Cloud Run ===" -ForegroundColor Cipher

$projectId = (gcloud config get-value project 2>$null)
$region = if ($env:REGION) { $env:REGION } else { "us-central1" }

if (-not $projectId) {
    Write-Host "[ERROR] No Google Cloud Project ID configured. Run: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Red
    exit 1
}

Write-Host "Google Cloud Project: $projectId" -ForegroundColor Green
Write-Host "Region: $region" -ForegroundColor Green

Write-Host "`n[1/5] Enabling APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com

Write-Host "`n[2/5] Building & Deploying FastAPI Backend..." -ForegroundColor Yellow
gcloud builds submit --tag "gcr.io/$projectId/crm-backend:latest" ./backend
gcloud run deploy crm-backend `
  --image "gcr.io/$projectId/crm-backend:latest" `
  --region $region `
  --platform managed `
  --allow-unauthenticated `
  --port 8000

$backendUrl = (gcloud run services describe crm-backend --region $region --format 'value(status.url)')
Write-Host "Backend live at: $backendUrl" -ForegroundColor Cyan

Write-Host "`n[3/5] Building & Deploying Frontend..." -ForegroundColor Yellow
gcloud builds submit --tag "gcr.io/$projectId/crm-frontend:latest" ./frontend -f ./frontend/Dockerfile.prod

gcloud run deploy crm-frontend `
  --image "gcr.io/$projectId/crm-frontend:latest" `
  --region $region `
  --platform managed `
  --allow-unauthenticated `
  --port 8080

$frontendUrl = (gcloud run services describe crm-frontend --region $region --format 'value(status.url)')

Write-Host "`n[4/5] Updating Backend CORS with Frontend URL..." -ForegroundColor Yellow
gcloud run services update crm-backend `
  --region $region `
  --set-env-vars "BACKEND_CORS_ORIGINS=[`"$frontendUrl`",`"http://localhost:5173`"]"

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  DEPLOIMENT COMPLETE!" -ForegroundColor Green
Write-Host "   Frontend URL: $frontendUrl" -ForegroundColor White
Write-Host "   Backend URL:  $backendUrl" -ForegroundColor White
Write-Host "   API Docs:     $backendUrl/docs" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Green
