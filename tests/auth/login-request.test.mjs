import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLoginRequest } from "../../lib/auth/login-request.ts";

test("login credentials are sent in a POST body, never the URL", () => {
    const email = "synthetic@example.invalid";
    const password = "synthetic-test-password";
    const request = createLoginRequest(email, password);
    const url = new URL(request.url, "https://supportai.example");
    const body = JSON.parse(String(request.init.body));

    assert.equal(request.init.method, "POST");
    assert.equal(url.search, "");
    assert.equal(body.email, email);
    assert.equal(body.password, password);
});

test("login's native pre-hydration fallback submits as POST", async () => {
    const source = await readFile(new URL("../../app/login/page.tsx", import.meta.url), "utf8");
    assert.match(source, /<form[^>]*method="post"[^>]*action="\/api\/auth\/login"/);
});
