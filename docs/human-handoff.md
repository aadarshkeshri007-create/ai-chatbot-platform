# Human handoff configuration

SupportAI handoffs are persisted in `handoff_requests` and `handoff_messages`.
Apply `supabase/migrations/20261017120000_add_handoff_requests.sql` to the
Supabase project before enabling the inbox in production. This migration is not
executed by the application.

The handoff flow works without email. To enable owner notifications, configure
these server-side environment variables:

- `RESEND_API_KEY`
- `SUPPORTAI_FROM_EMAIL`

`NEXT_PUBLIC_APP_URL` can be set to the deployed application URL so notification
links point directly to `/handoffs`. If it is not set, the application uses
Vercel's deployment URL when available.

Public visitors receive an opaque access token after creating a request. The
token is stored only as a hash and is used by the widget to poll for human
replies. Owners access requests through the authenticated `/handoffs` page.
