#!/usr/bin/env bash
# deploy-staging.sh - Build Docker image, push to Artifact Registry, deploy to
# Cloud Run with dedicated service account, build frontend with VITE_API_URL=/api,
# and deploy to Firebase Hosting.
#
# Usage: bash scripts/deploy-staging.sh
# Requires: gcloud auth, Docker, .env.staging, firebase CLI
#
# GCP Project: gen-lang-client-0535844903
# Service: loadpilot-api  SA: loadpilot-api-sa@gen-lang-client-0535844903.iam.gserviceaccount.com

set -euo pipefail

# -- Configuration
PROJECT_ID="gen-lang-client-0535844903"
REGION="us-central1"
IMAGE_REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/loadpilot/loadpilot-api"
SERVICE_NAME="loadpilot-api"
SERVICE_ACCOUNT="loadpilot-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
CLOUD_SQL_INSTANCE="${PROJECT_ID}:${REGION}:loadpilot-staging"
DB_SOCKET_PATH="/cloudsql/${CLOUD_SQL_INSTANCE}"
FIREBASE_HOSTING_URL="https://${PROJECT_ID}.web.app"

# -- Step 1: Validate prerequisites
echo "[1/6] Validating prerequisites..."

if [ ! -f .env.staging ]; then
  echo "ERROR: .env.staging not found. Run scripts/provision-gcp.sh first."
  exit 1
fi

for cmd in docker gcloud firebase git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found in PATH."
    exit 1
  fi
done

echo "Prerequisites OK."

# -- Step 2: Build Docker image tagged with git SHA
echo "[2/6] Building Docker image..."
GIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="${IMAGE_REPO}:${GIT_SHA}"
IMAGE_LATEST="${IMAGE_REPO}:latest"

docker build -t "${IMAGE_TAG}" -t "${IMAGE_LATEST}" .
echo "Docker image built: ${IMAGE_TAG}"

# -- Step 3: Push to Artifact Registry (us-central1-docker.pkg.dev)
echo "[3/6] Pushing to Artifact Registry..."
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker push "${IMAGE_TAG}"
docker push "${IMAGE_LATEST}"
echo "Image pushed: ${IMAGE_TAG}"

# -- Step 4: Deploy to Cloud Run with dedicated service account
echo "[4/6] Deploying Cloud Run service ${SERVICE_NAME}..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --service-account="${SERVICE_ACCOUNT}" \
  --add-cloudsql-instances="${CLOUD_SQL_INSTANCE}" \
  --set-secrets="DB_PASSWORD=DB_PASSWORD:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="NODE_ENV=staging,DB_SOCKET_PATH=${DB_SOCKET_PATH},DB_USER=trucklogix_staging,DB_NAME=trucklogix_staging,FIREBASE_PROJECT_ID=${PROJECT_ID},CORS_ORIGIN=${FIREBASE_HOSTING_URL}" \
  --min-instances=0 \
  --max-instances=2 \
  --memory=512Mi \
  --cpu=1 \
  --port=8080 \
  --allow-unauthenticated \
  --quiet

echo "Cloud Run deployed: ${SERVICE_NAME}"

# -- Step 5: Build frontend with VITE_API_URL=/api (sourcing .env.staging)
echo "[5/6] Building frontend with VITE_API_URL=/api..."
# Source .env.staging which sets VITE_API_URL=/api (not localhost)
set -a
# shellcheck source=.env.staging
source .env.staging
set +a

if [ -z "${VITE_API_URL:-}" ]; then
  echo "ERROR: VITE_API_URL not set in .env.staging. Expected VITE_API_URL=/api"
  exit 1
fi
if echo "${VITE_API_URL}" | grep -q "localhost"; then
  echo "ERROR: VITE_API_URL='${VITE_API_URL}' contains localhost - must be /api for staging"
  exit 1
fi

npm run build
echo "Frontend built with VITE_API_URL=${VITE_API_URL}"

# -- Step 6: Deploy to Firebase Hosting
echo "[6/6] Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting --project="${PROJECT_ID}"
echo "Firebase Hosting deployed."

echo ""
echo "=== Staging deployment complete ==="
echo "Cloud Run service: ${SERVICE_NAME} in ${REGION}"
echo "Firebase Hosting:  ${FIREBASE_HOSTING_URL}"
echo "Image tag:         ${IMAGE_TAG}"
echo ""
echo "Next: bash scripts/run-staging-migrations.sh"
echo "Then: bash scripts/verify-staging.sh"
