# Sean Tour Frontend

Vue 3 + Vite frontend for the `sean-tour` project.

## Features in this demo

- Minimal demo landing page
- Email sign up
- Email sign in
- Google OAuth sign in
- Forgot password (send reset email)
- Reset password page

## Setup

1. Install dependencies:

```bash
pnpm --dir frontend install
```

2. Create env file from template:

```bash
cp frontend/.env.example frontend/.env
```

3. Fill Supabase values in `frontend/.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_REDIRECT_URL`
- `VITE_RESET_PASSWORD_REDIRECT_URL`

4. In Supabase dashboard, configure Auth URLs:

- Site URL: `http://localhost:5173`
- Additional redirect URLs:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/auth/reset-password`

5. Enable Google provider in Supabase Auth and set Google OAuth credentials.

## Run

```bash
pnpm --dir frontend dev
```

## Build

```bash
pnpm --dir frontend build
```
