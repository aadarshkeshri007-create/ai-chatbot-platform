import assert from "node:assert/strict";
import test from "node:test";

import { getClientIp } from "./rate-limit.ts";

test("uses Vercel's trusted client IP header", () => {
  const request = new Request("https://support.example/api/public/chat", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.10, 198.51.100.4",
      "x-real-ip": "192.0.2.20",
      "x-forwarded-for": "192.0.2.30",
    },
  });

  assert.equal(getClientIp(request), "203.0.113.10");
});

test("ignores generic forwarding headers without the trusted Vercel header", () => {
  const request = new Request("https://support.example/api/public/chat", {
    headers: {
      "x-real-ip": "192.0.2.20",
      "x-forwarded-for": "192.0.2.30",
    },
  });

  assert.equal(getClientIp(request), "no-ip-header");
});
