"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { normalizeOrigin } from "@/lib/public-chat-origin";
import {
  getSafeInstallationStatusError,
  parseInstallationStatus,
  type InstallCheck,
} from "@/lib/installation-status";

const INSTALLATION_STATUS_ERROR = "Unable to load installation checks right now. Please retry.";

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function InstallWidgetPage() {
  const [assistantId, setAssistantId] = useState("");
  const [websiteOrigin, setWebsiteOrigin] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [checks, setChecks] = useState<InstallCheck[]>([]);
  const [checksLoading, setChecksLoading] = useState(true);
  const [checksError, setChecksError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const refreshChecks = useCallback(async () => {
    setChecksLoading(true);
    setChecksError("");
    try {
      const response = await fetch("/api/widget-installation/status", { cache: "no-store" });
      const redirectedToLogin = response.redirected &&
        new URL(response.url).pathname.replace(/\/$/, "") === "/login";
      if (redirectedToLogin) throw new Error("Your session has expired. Sign in again, then retry.");

      const contentType = response.headers.get("content-type") ?? "";
      const payload = await readJsonResponse(response);
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(response.ok
          ? "The server returned an unexpected response. Please retry."
          : INSTALLATION_STATUS_ERROR);
      }
      if (!response.ok) {
        throw new Error(getSafeInstallationStatusError(payload) ?? INSTALLATION_STATUS_ERROR);
      }
      const result = parseInstallationStatus(payload);
      if (!result) throw new Error("The server returned an invalid installation status. Please retry.");

      setChecks(result.checks);
      return result.checks;
    } catch (cause) {
      setChecksError(cause instanceof Error ? cause.message : INSTALLATION_STATUS_ERROR);
      return null;
    } finally {
      setChecksLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Sign in to load your assistant installation details.");
        setLoading(false);
        return;
      }
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("assistant_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError || !data?.assistant_id) setError("Your Assistant ID is not available yet.");
      else setAssistantId(data.assistant_id);
      setLoading(false);
      await refreshChecks();
    };
    void load().catch(() => {
      setError("Unable to load your assistant installation details. Please retry.");
      setLoading(false);
    });
  }, [refreshChecks]);

  const verifiedOrigin = checks.find((check) => check.status === "verified" && check.verified_at)?.expected_origin;
  const snippet = useMemo(() => {
    if (!assistantId || typeof window === "undefined") return "";
    const tokenAttribute = challengeToken ? `\n  data-verification-token="${challengeToken}"` : "";
    return `<script\n  src="${window.location.origin}/widget.js"\n  data-assistant-id="${assistantId}"${tokenAttribute}\n  defer\n></script>`;
  }, [assistantId, challengeToken]);

  const startVerification = async () => {
    setError("");
    setMessage("");
    setCopied(false);
    const parsed = normalizeOrigin(websiteOrigin.trim());
    if (!parsed || parsed.origin !== websiteOrigin.trim()) {
      setError("Enter the website origin only, including https:// and any port. Do not include a path.");
      return;
    }
    setWorking(true);
    try {
      const response = await fetch("/api/widget-installation/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: parsed.origin }),
      });
      const payload = await readJsonResponse(response);
      const result = typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? payload as { id?: unknown; token?: unknown; error?: unknown }
        : {};
      if (!response.ok || typeof result.id !== "string" || !/^[0-9a-f-]{36}$/i.test(result.id) ||
        typeof result.token !== "string" || !/^[A-Za-z0-9_-]{40,100}$/.test(result.token)) {
        throw new Error("Unable to start verification. Check the website origin and installation configuration, then retry.");
      }
      setWebsiteOrigin(parsed.origin);
      setChallengeId(result.id);
      setChallengeToken(result.token);
      setMessage("Temporary verification snippet ready. Add it to the expected website and load that site within 10 minutes.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start verification.");
    } finally {
      setWorking(false);
    }
  };

  const copySnippet = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard access failed. Select and copy the snippet manually.");
    }
  };

  const checkVerification = async () => {
    setWorking(true);
    setError("");
    try {
      const latestChecks = await refreshChecks();
      if (!latestChecks) return;
      setMessage("Status refreshed. A check becomes verified only after the widget loads from the expected origin and its assistant configuration request succeeds.");
      const currentChallenge = latestChecks.find((check) => check.id === challengeId);
      if (!currentChallenge) {
        setError("The current verification check is not in the status list. Create a new check and use its temporary snippet.");
        return;
      }
      if (currentChallenge.status === "verified" && currentChallenge.verified_at) {
        setChallengeToken("");
        setMessage(`Widget load verified at ${new Date(currentChallenge.verified_at).toLocaleString()}. Remove the temporary data-verification-token attribute from your installed snippet.`);
      } else if (currentChallenge.status === "expired") {
        setMessage("This verification challenge expired. Create a new check and use its temporary snippet.");
      } else {
        setMessage("This check is still pending. Reload the website with the temporary snippet, then refresh status again.");
      }
    } catch (cause) {
      setChecksError(cause instanceof Error ? cause.message : INSTALLATION_STATUS_ERROR);
    } finally {
      setWorking(false);
    }
  };

  const previewUrl = assistantId ? `/widget-preview?assistant_id=${encodeURIComponent(assistantId)}` : "about:blank";

  return (
    <PageFrame>
      <div className="mx-auto w-full max-w-5xl">
        <PageHeader eyebrow="Go live" title="Install Widget" description="Install the same assistant launcher and chat panel configured in Settings." />
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading assistant details…</p> : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className="space-y-7">
              <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Your embed snippet</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This snippet uses your Assistant ID and loads the widget from this SupportAI deployment.</p>
                {verifiedOrigin && <p className="mt-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">Last verified widget load: {verifiedOrigin}</p>}
                <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{snippet || "Assistant ID unavailable"}</code></pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copySnippet()} disabled={!snippet} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50">{copied ? "Copied" : "Copy snippet"}</button>
                  <Link href="/settings" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Edit appearance and domains</Link>
                </div>
                {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
                {message && <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{message}</p>}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Verify a live installation</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Enter the exact website origin, create a short-lived challenge, copy the temporary snippet, then publish or reload the website. The widget confirms itself after its script and assistant configuration load from that origin.</p>
                <label htmlFor="install-origin" className="mt-4 block text-sm font-medium text-slate-800 dark:text-slate-200">Website origin</label>
                <input id="install-origin" value={websiteOrigin} onChange={(event) => {
                  const nextOrigin = event.target.value;
                  if (nextOrigin !== websiteOrigin) {
                    setChallengeId("");
                    setChallengeToken("");
                  }
                  setWebsiteOrigin(nextOrigin);
                }} placeholder="https://support.example.com" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void startVerification()} disabled={working || !assistantId} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50">{working ? "Working…" : "Create verification check"}</button>
                  <button type="button" onClick={() => void checkVerification()} disabled={working} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Refresh status</button>
                </div>
                {checksLoading && <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">Loading installation checks…</p>}
                {checksError && (
                  <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    <p>{checksError}</p>
                    <button type="button" onClick={() => void refreshChecks()} disabled={checksLoading} className="mt-2 min-h-10 rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950">Retry</button>
                  </div>
                )}
                {!checksLoading && !checksError && checks.length === 0 && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No installation checks yet.</p>}
                {!checksLoading && checks.length > 0 && (
                  <ul className="mt-3 space-y-2" aria-label="Recent installation checks">
                    {checks.map((check) => (
                      <li key={check.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                        <span className="break-all text-slate-700 dark:text-slate-200">{check.expected_origin}</span>
                        <span className="text-xs capitalize text-slate-600 dark:text-slate-300">{check.status} · {new Date(check.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">Verification confirms a successful widget configuration load at one point in time. It cannot guarantee the site keeps the snippet installed or that future AI requests will succeed. The one-use token expires after 10 minutes.</p>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add the snippet to your site</h2>
                <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  <li><strong>HTML:</strong> paste the snippet before the closing <code>&lt;/body&gt;</code> tag on each page where support should appear.</li>
                  <li><strong>WordPress:</strong> use a trusted site-wide custom-code or footer-script facility, or a Custom HTML block on one page. Avoid placing the JavaScript in a rich-text paragraph.</li>
                  <li><strong>Shopify:</strong> add it through the theme’s supported custom code area near the end of the storefront body, then preview and publish the theme.</li>
                  <li><strong>Wix:</strong> add it through the site’s custom-code integration and choose body-end placement and the intended pages, then publish.</li>
                  <li><strong>Webflow:</strong> add it to the site or page footer custom code, publish the site, then inspect the published domain rather than only Designer preview.</li>
                </ol>
                <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-slate-100">Troubleshooting</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  <li>For a 403, add the exact origin (scheme and port included) to the deployment’s <code>PUBLIC_CHAT_ALLOWED_ORIGINS</code>, and add its hostname to Settings → Allowed Domains when that list is restricted.</li>
                  <li>Publish the site after adding the code. Check the browser Network panel for <code>/widget.js</code>, <code>/api/public/assistant-config</code>, and the verification request.</li>
                  <li>Cross-origin browser requests are subject to CORS. A blocked or missing configuration request cannot be treated as verified. Do not use wildcard origins.</li>
                </ul>
              </section>
            </div>

            <section className="h-fit rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Live widget preview</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">This loads the deployed widget code. The preview uses this app’s origin, so assistant domain restrictions may prevent chat requests unless that origin is allowed.</p>
              </div>
              <iframe title="Live SupportAI widget preview" src={previewUrl} className="h-[620px] w-full rounded-lg border border-slate-200 dark:border-slate-700" />
            </section>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
