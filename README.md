This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Embeddable SupportAI widget

The public widget is served from `/widget.js` and uses the public assistant ID
from `data-assistant-id`. It does not require React on the host website:

```html
<script
  src="https://YOUR_DEPLOYED_DOMAIN/widget.js"
  data-assistant-id="2523d5cb-9fdc-4e73-9739-7d89d708c2aa"
  defer
></script>
```

The widget derives the API origin from the script URL and sends messages to
`/api/public/chat`. The assistant ID is public configuration, not a secret.
The service-role key and private profile data remain server-side.

### CORS configuration

Set `PUBLIC_CHAT_ALLOWED_ORIGINS` in the deployed application environment to a
comma-separated list of exact website origins, including scheme and port when
needed:

```text
PUBLIC_CHAT_ALLOWED_ORIGINS=https://customer.example,https://www.customer.example
```

The public chat route accepts same-origin requests and allowlisted cross-origin
requests. It handles `OPTIONS` preflight requests, returns `Vary: Origin`, and
does not support a wildcard origin. Requests from origins not in the explicit
allowlist are rejected. CORS is only a browser access control; it is not
authentication.

### Local testing

1. Start SupportAI with `npm run dev`.
2. Set `PUBLIC_CHAT_ALLOWED_ORIGINS=http://localhost:8080` in `.env.local` and
   restart the dev server.
3. Serve a separate test page from another origin, for example:
   `npx serve . -l 8080`.
4. Add the script tag above to that page, using
   `http://localhost:3000/widget.js` and the development assistant ID.
5. Open the page at `http://localhost:8080` and test a handbook question and an
   unrelated question. Inspect the browser Network panel for the preflight and
   `POST /api/public/chat` requests.

For deployment, set `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the
`NEXT_PUBLIC_SUPABASE_URL` and publishable key for the intended Supabase
project, and `PUBLIC_CHAT_ALLOWED_ORIGINS` in the server environment. Apply
the existing Supabase migrations before enabling the widget.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
