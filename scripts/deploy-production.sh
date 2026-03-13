#!/usr/bin/env bash
# deploy-production.sh — Build Docker image, push to Artifact Registry, deploy to
# production Cloud Run (zero initial traffic), and deploy to Firebase Hosting.
#
# PRODUCTION DIFFERENCES FROM deploy-staging.sh:
#   - Service: loadpilot-api-prod (NOT loadpilot-api)
#   - --no-traffic: initial deploy receives 0% traffic (manual gate required)
#   - --min-instances=1: no cold starts in production (staging uses 0)
#   - NODE_ENV=production
#   - Cloud SQL: gen-lang-client-0535844903:us-central1:loadpilot-prod
#   - Service account: loadpilot-api-prod-sa
#   - Secrets: DB_PASSWORD_PROD:latest, GEMINI_API_KEY_PROD:latest
#   - DB_USER=trucklogix_prod, DB_NAME=trucklogix_prod
#
# Usage: bash scripts/deploy-production.sh
# Requires: gcloud auth, Docker, .env.production, firebase CLI
#
# GCP Project: gen-lang-client-0535844903
# Service: loadpilot-api-prod
# SA: loadpilot-api-prod-sa@gen-lang-client-0535844903.iam.gserviceaccount.com

set -euo pipefail

# -- Configuration
PROJECT_ID="gen-lang-client-0535844903"
REGION="us-central1"
IMAGE_REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/loadpilot/loadpilot-api"
# Production Cloud Run service name — separate from staging (loadpilot-api)
SERVICE_NAME="loadpilot-api-prod"
# Production service account — separate from staging (loadpilot-api-sa)
SERVICE_ACCOUNT="loadpilot-api-prod-sa@${PROJECT_ID}.iam.gserviceaccount.com"
# Production Cloud SQL instance — dedicated-core, SLA-backed
CLOUD_SQL_INSTANCE="${PROJECT_ID}:${REGION}:loadpilot-prod"
# Production DB socket path (Unix socket via Cloud SQL connector)
DB_SOCKET_PATH="/cloudsql/${CLOUD_SQL_INSTANCE}"
FIREBASE_HOSTING_URL="https://app.loadpilot.com"

# -- Step 1: Validate prerequisites
echo "[1/7] Validating prerequisites..."

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Run scripts/provision-production.sh first."
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
echo "[2/7] Building Docker image..."
GIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="${IMAGE_REPO}:${GIT_SHA}"
IMAGE_PROD="${IMAGE_REPO}:prod-${GIT_SHA}"

docker build -t "${IMAGE_TAG}" -t "${IMAGE_PROD}" .
echo "Docker image built: ${IMAGE_TAG}"

# -- Step 3: Push to Artifact Registry (us-central1-docker.pkg.dev)
echo "[3/7] Pushing to Artifact Registry..."
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker push "${IMAGE_TAG}"
docker push "${IMAGE_PROD}"
echo "Image pushed: ${IMAGE_TAG}"

# -- Step 4: Deploy to production Cloud Run with zero initial traffic
#
# KEY PRODUCTION FLAGS:
#   --no-traffic: New revision deployed but receives 0% traffic.
#                 Operators must explicitly route traffic after smoke tests pass.
#                 Prevents accidental production user impact on first deploy.
#   --min-instances=1: Eliminate cold starts for production users.
#                      Staging uses 0 (acceptable latency for dev/QA).
#                      Production requires 1 (cold start = degraded UX for first user).
echo "[4/7] Deploying production Cloud Run service ${SERVICE_NAME} (zero initial traffic)..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --service-account="${SERVICE_ACCOUNT}" \
  --add-cloudsql-instances="${CLOUD_SQL_INSTANCE}" \
  --set-secrets="DB_PASSWORD=DB_PASSWORD_PROD:latest,GEMINI_API_KEY=GEMINI_API_KEY_PROD:latest" \
  --set-env-vars="NODE_ENV=production,DB_SOCKET_PATH=${DB_SOCKET_PATH},DB_USER=trucklogix_prod,DB_NAME=trucklogix_prod,FIREBASE_PROJECT_ID=${PROJECT_ID},CORS_ORIGIN=${FIREBASE_HOSTING_URL}" \
  --min-instances=1 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --port=8080 \
  --allow-unauthenticated \
  --no-traffic \
  --quiet

echo "Production Cloud Run deployed: ${SERVICE_NAME} (receiving 0% traffic)"

# -- Step 5: Capture deployed revision name for traffic management
echo "[5/7] Capturing revision name..."
REVISION_NAME=$(gcloud run revisions list \
  --service="${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(metadata.name)" \
  --sort-by="~metadata.creationTimestamp" \
  --limit=1)

echo "Deployed revision: ${REVISION_NAME}"
echo "REVISION_NAME=${REVISION_NAME}" > /tmp/production-revision.env

# -- Step 6: Build frontend with VITE_API_URL=/api (sourcing .env.production)
echo "[6/7] Building frontend with VITE_API_URL=/api..."
# Source .env.production which sets VITE_API_URL=/api (not localhost)
set -a
# shellcheck source=.env.production
source .env.production
set +a

if [ -z "${VITE_API_URL:-}" ]; then
  echo "ERROR: VITE_API_URL not set in .env.production. Expected VITE_API_URL=/api"
  exit 1
fi
if echo "${VITE_API_URL}" | grep -q "localhost"; then
  echo "ERROR: VITE_API_URL='${VITE_API_URL}' contains localhost — must be /api for production"
  exit 1
fi

npm run build
echo "Frontend built with VITE_API_URL=${VITE_API_URL}"

# -- Step 7: Deploy to Firebase Hosting
echo "[7/7] Deploying frontend to Firebase Hosting..."

# Temporarily patch firebase.json to point /api/** rewrite at production Cloud Run service
# This is necessary because firebase.json defaults to staging service (loadpilot-api)
FIREBASE_JSON="firebase.json"
FIREBASE_BACKUP="${FIREBASE_JSON}.staging-backup"
cp "${FIREBASE_JSON}" "${FIREBASE_BACKUP}"

# Replace staging service ID with production service ID in the rewrite rule
sed -i 's/"serviceId": "loadpilot-api"/"serviceId": "loadpilot-api-prod"/' "${FIREBASE_JSON}"
echo "Patched firebase.json: /api/** -> ${SERVICE_NAME} (production)"

firebase deploy --only hosting --project="${PROJECT_ID}"

# Restore original firebase.json (staging default)
mv "${FIREBASE_BACKUP}" "${FIREBASE_JSON}"
echo "Restored firebase.json to staging default."
echo "Firebase Hosting deployed with production rewrite."

echo ""
echo "=== Production deployment complete (ZERO TRAFFIC) ==="
echo "Cloud Run service: ${SERVICE_NAME} in ${REGION}"
echo "Deployed revision: ${REVISION_NAME}"
echo "Firebase Hosting:  ${FIREBASE_HOSTING_URL}"
echo "Image tag:         ${IMAGE_TAG}"
echo ""
echo "IMPORTANT: This revision is receiving 0% traffic."
echo "Next steps:"
echo "  1. Verify health on revision URL:"
echo "     REVISION_URL=\$(gcloud run revisions describe ${REVISION_NAME} \\"
echo "       --region=${REGION} --project=${PROJECT_ID} --format='value(status.url)')"
echo "     curl \"\${REVISION_URL}/api/health\""
echo "  2. Run smoke tests against revision URL"
echo "  3. Route internal traffic (Gate A): bash scripts/gate-a-internal.sh"
echo ""
echo "Revision name saved to: /tmp/production-revision.env"
