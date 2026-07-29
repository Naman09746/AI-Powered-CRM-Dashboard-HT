#!/bin/bash
set -e

echo "=== Deploying AI-Powered CRM Dashboard to Google Cloud Run ==="

# Check gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "[ERROR] gcloud CLI is not installed. Please install it from https://cloud.google.com/sdk"
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION=${REGION:-"us-central1"}

if [ -z "$PROJECT_ID" ]; then
    echo "[ERROR] No Google Cloud Project ID configured. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "Google Cloud Project: $PROJECT_ID"
echo "Region: $REGION"

# Enable required APIs
echo "[1/5] Enabling Cloud Run, Cloud Build, and Container Registry APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com sqladmin.googleapis.com

# Build & Deploy Backend
echo "[2/5] Building & Deploying FastAPI Backend..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/crm-backend:latest ./backend
gcloud run deploy crm-backend \
  --image gcr.io/$PROJECT_ID/crm-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8000

BACKEND_URL=$(gcloud run services describe crm-backend --region $REGION --format 'value(status.url)')
echo "Backend live at: $BACKEND_URL"

# Build & Deploy Frontend
echo "[3/5] Building & Deploying Frontend..."
gcloud builds submit \
  --config - ./frontend <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-f', 'Dockerfile.prod', '--build-arg', 'VITE_API_BASE_URL=$BACKEND_URL', '-t', 'gcr.io/$PROJECT_ID/crm-frontend:latest', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/$PROJECT_ID/crm-frontend:latest']
EOF

gcloud run deploy crm-frontend \
  --image gcr.io/$PROJECT_ID/crm-frontend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080

FRONTEND_URL=$(gcloud run services describe crm-frontend --region $REGION --format 'value(status.url)')

# Update Backend CORS origins with frontend URL
echo "[4/5] Updating Backend CORS with Frontend URL..."
gcloud run services update crm-backend \
  --region $REGION \
  --set-env-vars "BACKEND_CORS_ORIGINS=[\"$FRONTEND_URL\",\"http://localhost:5173\"]"

echo ""
echo "======================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "   Frontend URL: $FRONTEND_URL"
echo "   Backend URL:  $BACKEND_URL"
echo "   Docs URL:     $BACKEND_URL/docs"
echo "======================================================="
