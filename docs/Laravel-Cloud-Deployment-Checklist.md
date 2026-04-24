# Laravel Cloud Deployment Checklist

This checklist is specific to the current Cliniqueue backend repository.

## Current Repository Status

The current repository is deployable to Laravel Cloud as an existing Laravel application.
It already uses a Laravel full-stack web shell with Inertia + React on top of the existing backend domain logic.

That means the recommended deployment path right now is:
1. Deploy this repository as an existing repository.
2. Add Laravel Object Storage, Laravel MySQL, Mailtrap SMTP, queue worker, and scheduler.
3. Keep the application on a single origin so web pages and API routes stay same-origin.

## Required Laravel Cloud Resources

1. App compute cluster
2. Laravel MySQL database
3. Laravel Object Storage bucket
4. Mailtrap SMTP credentials

## Required Environment Variables

Use production values for these variables:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://cliniqueue.example
APP_TIMEZONE=Asia/Jakarta

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

FILESYSTEM_DISK=s3
MEDIA_DISK=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=...
AWS_BUCKET=...
AWS_URL=...

MAIL_MAILER=smtp
MAIL_HOST=live.smtp.mailtrap.io
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=no-reply@cliniqueue.example
MAIL_FROM_NAME="${APP_NAME}"

SESSION_DOMAIN=cliniqueue.example
SANCTUM_STATEFUL_DOMAINS=cliniqueue.example
CORS_ALLOWED_ORIGINS=https://cliniqueue.example
```

## Required Build Commands

```bash
composer install --no-dev --optimize-autoloader
npm ci
npm run build
php artisan optimize
```

## Required Deploy Commands

```bash
php artisan migrate --force
```

Do not add `php artisan storage:link` for Laravel Cloud.
Laravel Cloud filesystems are ephemeral. Persistent uploads must use object storage.

## Required App Cluster Settings

1. Add one background process:
   - command: `php artisan queue:work --tries=1 --timeout=90`
2. Enable Scheduler

## Important Behavior Notes

1. Reservation reminder scheduling uses `onOneServer()`.
   This avoids duplicate reminder dispatches if the app is ever scaled to multiple replicas.
2. Queue workers and scheduled tasks are paused while an environment is hibernating.
   If reminder reliability matters, do not rely on hibernation for the main environment.
3. Clinic and doctor image uploads must use object storage in production.
   Keeping `FILESYSTEM_DISK=local` or `MEDIA_DISK=public` in Laravel Cloud will cause uploads to be non-persistent.
4. `APP_URL`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, and `CORS_ALLOWED_ORIGINS` must match the single deployed application origin.

## React Starter Kit Migration Note

If you later align this repository closer to the official Laravel React starter kit structure:
1. treat it as an internal frontend architecture refactor, not a deployment toggle
2. if you enable Inertia SSR on Laravel Cloud, update the build command from `npm run build` to `npm run build:ssr`
