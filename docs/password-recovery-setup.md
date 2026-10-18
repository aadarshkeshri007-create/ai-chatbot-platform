# Password recovery redirect setup

The recovery flow sends Supabase email links to `/auth/callback`. That route
exchanges the one-time PKCE code for the app's existing SSR cookie session and
then redirects to `/reset-password`.

In Supabase Dashboard → Authentication → URL Configuration:

- Keep **Site URL** set to the canonical deployed app origin.
- Add `http://localhost:3000/auth/callback` to **Redirect URLs** for local
  development.
- Add `https://YOUR_DEPLOYED_HOST/auth/callback` for each deployed app origin.

Do not add wildcard origins. The recovery request derives its callback origin
from the currently loaded app, and Supabase must allow that exact callback URL.
