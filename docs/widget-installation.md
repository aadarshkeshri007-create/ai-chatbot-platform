# SupportAI public widget installation

This guide documents the public widget and API behavior implemented by this
application. The widget is self-contained and does not require React or other
SupportAI components on the host website.

## Before you begin

You need:

- A deployed SupportAI application URL, referred to below as
  `https://YOUR_SUPPORTAI_DOMAIN`.
- A public Assistant ID.
- Server-side configuration for the SupportAI deployment.
- Knowledge-base documents that are appropriate for public customer access.

### Get the Assistant ID

Sign in to SupportAI and open **Settings**. The **Assistant ID** section
displays the public UUID and provides a **Copy** button.

The ID is public configuration, not a secret. It is used to select an
assistant, not to authenticate a caller. Do not put service-role keys, Gemini
keys, Supabase keys, or other server secrets in the host page.

The ID must be a UUID. The public route rejects malformed IDs before loading an
assistant.

## Configure the deployment

The SupportAI server requires these environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
PUBLIC_CHAT_ALLOWED_ORIGINS=https://support.example.com,https://www.support.example.com
```

Only the deployment server should receive `SUPABASE_SERVICE_ROLE_KEY`,
`GEMINI_API_KEY`, and the Upstash token. Do not copy any of them into browser
code.

### Global origin allowlist

`PUBLIC_CHAT_ALLOWED_ORIGINS` is a comma-separated list of exact origins. An
origin includes its scheme and, when applicable, port:

```text
PUBLIC_CHAT_ALLOWED_ORIGINS=https://customer.example,https://www.customer.example
```

The application also accepts same-origin requests. Wildcard origins are not
supported. Origin matching is exact; for example, these are different origins:

```text
https://customer.example
https://www.customer.example
http://customer.example
https://customer.example:8443
```

Restart the deployment after changing this environment variable.

### Per-assistant Allowed Domains

In **Settings → Allowed Domains**, add hostnames such as:

```text
support.customer.example
www.customer.example
```

Enter hostnames only. Do not enter:

```text
https://support.customer.example
support.customer.example/path
user:password@support.customer.example
*.customer.example
```

Matching is exact and case-insensitive after normalization. A configured
hostname does not automatically allow its parent domain or subdomains:

- `support.customer.example` does not allow `customer.example`;
- `customer.example` does not automatically allow `www.customer.example`;
- `customer.example` does not allow `evil-customer.example`.

Leaving the list empty disables the assistant-specific restriction. Global
origin restrictions still apply.

### How the widget preserves the host origin

The widget iframe is hosted on the SupportAI application origin:

```text
https://YOUR_SUPPORTAI_DOMAIN/widget-frame?assistant_id=...
```

The iframe does not call `/api/public/chat` directly. It sends a structured
request to the parent with `postMessage`. The `/widget.js` controller, running
in the host page, validates the iframe window and SupportAI origin, then calls
the API. Consequently, the API sees the customer's host-page origin on the
cross-origin request and can enforce the assistant's Allowed Domains list.

The iframe and controller also validate response origins and request IDs.
Assistant IDs from iframe messages are not trusted; the controller uses the
UUID captured from the original `data-assistant-id` attribute.

This preserves the existing iframe isolation, but CORS and origin checks are
still not user authentication. A non-browser client can forge HTTP headers,
so public assistants must contain only content intended for public access.

## Install the visual widget

The application serves a complete widget from `/widget.js`. Add this snippet
to the host page, replacing both placeholders:

```html
<script
  src="https://YOUR_SUPPORTAI_DOMAIN/widget.js"
  data-assistant-id="2523d5cb-9fdc-4e73-9739-7d89d708c2aa"
  defer
></script>
```

The script:

1. Reads `data-assistant-id` from its own script tag.
2. Creates a Shadow DOM launcher.
3. Opens an iframe at `/widget-frame?assistant_id=...`.
4. Lets the iframe call `/api/public/chat`.

The launcher is fixed to the lower-right corner, and the iframe is responsive
for small screens. The widget sends only the assistant ID and message in its
API request. It does not require a host-page framework.

## Call the public API directly

Use the direct API when you need custom UI or when you need the request origin
to be the host website for per-assistant domain validation.

Endpoint:

```text
POST https://YOUR_SUPPORTAI_DOMAIN/api/public/chat
```

Preflight:

```text
OPTIONS https://YOUR_SUPPORTAI_DOMAIN/api/public/chat
```

Request body:

```json
{
  "assistant_id": "2523d5cb-9fdc-4e73-9739-7d89d708c2aa",
  "message": "What are your refund terms?"
}
```

Only `assistant_id` and `message` are accepted. The message must be a
non-empty string of at most 8,000 characters. The request body is limited to
32 KiB by the route.

Example browser call:

```html
<script>
  async function askSupportAI(message) {
    const response = await fetch(
      "https://YOUR_SUPPORTAI_DOMAIN/api/public/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          assistant_id: "2523d5cb-9fdc-4e73-9739-7d89d708c2aa",
          message
        })
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "SupportAI request failed.");
    }

    return payload;
  }

  askSupportAI("What are your refund terms?")
    .then((payload) => {
      // Render payload.response as text or through a trusted,
      // sanitizing Markdown renderer. Do not inject it with innerHTML.
      document.querySelector("#support-answer").textContent = payload.response;
    })
    .catch((error) => {
      document.querySelector("#support-error").textContent = error.message;
    });
</script>

<p id="support-answer"></p>
<p id="support-error" role="alert"></p>
```

The browser automatically sends the page's `Origin` on a cross-origin fetch.
The SupportAI deployment must allow that origin globally, and the selected
assistant must allow its hostname when a non-empty Allowed Domains list is
configured.

## Response format

Successful responses are JSON:

```json
{
  "assistant_name": "AI Support",
  "welcome_message": "Hello! How can I assist you today?",
  "response": "Refunds are available within 30 days ...",
  "sources": [
    {
      "label": "customer-support-handbook.pdf"
    }
  ]
}
```

`assistant_name`, `welcome_message`, and `response` are strings. `sources` is
an array of objects with a display `label`. The response is grounded in the
selected assistant's processed knowledge base; the public route does not
accept a client-supplied conversation ID or document ID.

Treat `response`, `assistant_name`, `welcome_message`, and source labels as
untrusted output. Render plain text by default. If using Markdown, use a
renderer with HTML/raw-HTML disabled and a sanitization policy. Never insert
the response with `innerHTML` without sanitization.

## Rate limiting and errors

Public chat uses Upstash Redis rate limiting at 10 requests per 10 seconds per
assistant and client IP. A rate-limited response includes a `Retry-After`
header when available.

The route may return:

| Status | Meaning |
| --- | --- |
| `204` | Successful CORS preflight. |
| `400` | Invalid JSON, unsupported fields, malformed assistant ID, missing message, or message too long. |
| `403` | The request origin is not globally allowed or is not allowed for the selected assistant. |
| `404` | No assistant exists for the supplied public Assistant ID. |
| `429` | The public rate limit was exceeded. Honor `Retry-After` and retry later. |
| `503` | Rate-limit service, assistant lookup, retrieval, or other required backend service is unavailable. |
| `200` | JSON response containing the assistant answer and sources. |

The route returns an error object such as:

```json
{
  "error": "Origin is not allowed."
}
```

## Security model

The public Assistant ID is not an authentication credential. CORS and Allowed
Domains are browser-origin and integration controls, not proof of user
identity. Requests without a browser `Origin` can still be made by other
clients when the assistant has no configured domain restriction.

Only publish documents that the assistant is intended to discuss publicly.
Do not place private customer records, credentials, internal secrets, or
confidential operating instructions in a public assistant's knowledge base.

Do not expose:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `GEMINI_API_KEY`;
- Upstash tokens;
- server environment files;
- private Supabase credentials.

## Troubleshooting

### `400 Bad Request`

Check that:

- the JSON body is valid;
- the body contains only `assistant_id` and `message`;
- `assistant_id` is a complete UUID;
- `message` is a non-empty string;
- the message is no longer than 8,000 characters;
- the request body is not larger than 32 KiB.

### `403 Origin is not allowed`

Check both layers:

1. Add the exact origin, including scheme and port, to
   `PUBLIC_CHAT_ALLOWED_ORIGINS`.
2. If the assistant has Allowed Domains configured, add the exact hostname
   seen in the request's `Origin` header.

Do not add a path, wildcard, or lookalike hostname. Inspect the browser
Network panel to see the actual `Origin`. For the iframe widget, see the
current widget limitation above.

### `429 Too Many Requests`

The assistant/IP rate limit was exceeded. Stop retrying in a tight loop and
wait for the `Retry-After` interval. Do not attempt to evade the limit by
rotating client headers.

### `503 Service Unavailable`

Check the server logs and deployment configuration for:

- missing server environment variables;
- unavailable Upstash Redis;
- unavailable Supabase RPCs;
- failed knowledge-base retrieval;
- missing or unapplied Supabase migrations.

Never solve a `503` by placing a service-role or Gemini key in browser code.

### Common CORS symptoms

If the browser reports that the request was blocked by CORS:

- confirm the request reaches the SupportAI deployment;
- confirm the request's exact `Origin`;
- confirm the origin is in `PUBLIC_CHAT_ALLOWED_ORIGINS`;
- confirm the assistant's exact hostname is in Allowed Domains when the list
  is non-empty;
- confirm an `OPTIONS` preflight receives `204`;
- confirm the response includes `Access-Control-Allow-Origin` matching the
  request origin, not `*`;
- remember that CORS headers do not authenticate callers.

## Verification checklist

1. Copy the Assistant ID from SupportAI Settings.
2. Configure the deployment's global origin allowlist.
3. Configure the assistant's exact Allowed Domains, or leave it empty
   intentionally.
4. Install the `/widget.js` snippet or use the direct API integration.
5. Inspect `OPTIONS` and `POST` requests in the browser Network panel.
6. Test an allowed origin and a deliberately disallowed origin.
7. Confirm that public documents contain no confidential information.
