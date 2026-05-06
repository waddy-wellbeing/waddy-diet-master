# GCP Deployment Guide

This app can be deployed to GCP with the same GitHub -> Cloud Build -> Cloud Run shape you described, adapted for this repository's stack:

- Frontend and server logic: Next.js 16 on Cloud Run
- Database/Auth/Storage: Supabase
- CI/CD: Cloud Build trigger connected directly to GitHub
- Logs and tracing: Cloud Logging and Cloud Trace via Cloud Run

## What is implemented in this repo

- `next.config.ts` uses `output: 'standalone'` for Cloud Run-friendly builds
- `Dockerfile` builds and runs the Next.js standalone server on port `8080`
- `.dockerignore` trims the build context
- `cloudbuild.yaml` builds the image, pushes it to GCR, and deploys to Cloud Run
- `cloudbuild.yaml` reads build and runtime values from Secret Manager, so GitHub does not need deployment secrets

## Architecture on GCP

Use Cloud Run for the web application and keep Supabase as the managed backend:

- Cloud Run serves the Next.js app
- Supabase handles Postgres, auth, and object storage
- Cloud Logging captures runtime and build logs
- Secret Manager stores build values and runtime secrets

This differs from the Firebase example in one important way: there are no Cloud Functions or Firestore deploy steps because this app already uses Supabase for backend services.

## Required GCP services

Enable these APIs in your GCP project:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com
```

## Required Secret Manager entries

Cloud Build now expects these secrets to exist in GCP:

- `next-public-supabase-url`
- `next-public-supabase-anon-key`
- `next-public-site-url`
- `next-public-vapid-public-key`
- `supabase-service-role-key`
- `vapid-private-key`
- `vapid-subject`

The `NEXT_PUBLIC_*` values are public to the browser, but this setup still keeps them in GCP so nothing deployment-related needs to be configured in GitHub.

## First-time setup

### 1. Create the secrets

```bash
printf '%s' 'https://YOUR_PROJECT.supabase.co' | gcloud secrets create next-public-supabase-url --data-file=-
printf '%s' 'YOUR_SUPABASE_ANON_KEY' | gcloud secrets create next-public-supabase-anon-key --data-file=-
printf '%s' 'https://YOUR_DOMAIN_OR_RUN_URL' | gcloud secrets create next-public-site-url --data-file=-
printf '%s' 'YOUR_OPTIONAL_PUBLIC_VAPID_KEY' | gcloud secrets create next-public-vapid-public-key --data-file=-
printf '%s' 'YOUR_SUPABASE_SERVICE_ROLE_KEY' | gcloud secrets create supabase-service-role-key --data-file=-
printf '%s' 'YOUR_VAPID_PRIVATE_KEY' | gcloud secrets create vapid-private-key --data-file=-
printf '%s' 'mailto:support@example.com' | gcloud secrets create vapid-subject --data-file=-
```

If a secret already exists, add a new version instead:

```bash
printf '%s' 'NEW_VALUE' | gcloud secrets versions add SECRET_NAME --data-file=-
```

### 2. Allow Cloud Build to read them

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for secret in \
  next-public-supabase-url \
  next-public-supabase-anon-key \
  next-public-site-url \
  next-public-vapid-public-key \
  supabase-service-role-key \
  vapid-private-key \
  vapid-subject
do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${CLOUDBUILD_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3. Allow the Cloud Run runtime to read private secrets

```bash
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in supabase-service-role-key vapid-private-key
do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

If you deploy Cloud Run with a custom service account, bind that account instead.

### 4. Run the first deploy manually

From the repository root:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

This creates and deploys the service with:

- Region: `europe-west4`
- Public access enabled
- Max instances: `2`
- Runtime env vars and runtime secrets attached automatically

### 5. Create a Cloud Build trigger connected to GitHub

This is the piece that removes the need for GitHub deployment secrets. GCP watches your repo directly and runs `cloudbuild.yaml` inside GCP.

```bash
gcloud builds triggers create github \
  --name="bite-right-main" \
  --repo-name="bite-right" \
  --repo-owner="YOUR_GITHUB_ORG_OR_USER" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

If your GCP project uses the newer Developer Connect flow, create the trigger in the Cloud Build UI and point it at `cloudbuild.yaml`. The deployment model stays the same.

## Why the reference repo has no GitHub secrets

That usually means GCP is the deployment initiator, not GitHub Actions. In practice, one of these is happening:

- Cloud Build has a GitHub trigger configured in GCP
- Firebase Hosting or another Google-managed integration is performing the deploy from inside GCP

In both cases, deployment credentials and deploy-time secrets live in GCP, not in the GitHub repository settings.

## Ongoing deploy flow

After the first-time setup, every push matched by the Cloud Build trigger will:

1. trigger Cloud Build from GitHub
2. load build and runtime values from Secret Manager
3. build a new container image
4. deploy a new Cloud Run revision

Because `cloudbuild.yaml` applies runtime env vars and secret bindings during deploy, each revision stays self-consistent.

## Useful commands

Manual deploy:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

List revisions:

```bash
gcloud run revisions list --service=bite-right-web --region=europe-west4
```

Read Cloud Run logs:

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="bite-right-web"' --limit=100
```

Describe the service:

```bash
gcloud run services describe bite-right-web --region=europe-west4
```

## Notes

- This repo currently builds successfully for Cloud Run. The existing build still emits metadata warnings from several routes; those are unrelated to GCP deployment.
- If you later move off GCR, the same setup can be switched to Artifact Registry with small changes to the image path and IAM permissions.