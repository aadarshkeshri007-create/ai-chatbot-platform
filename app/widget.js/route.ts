import { INSTALLATION_VERIFY_PATH, isVerificationConfigReady } from "@/lib/widget-installation";

const widgetScript = `(() => {
  const isVerificationConfigReady = (${isVerificationConfigReady.toString()});
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return;

  const assistantId = script.dataset.assistantId?.trim();
  const assistantIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!assistantId || !assistantIdPattern.test(assistantId)) {
    console.error("SupportAI widget: data-assistant-id is required.");
    return;
  }

  const appOrigin = new URL(script.src, window.location.href).origin;
  const verificationToken = script.dataset.verificationToken;
  const sessionStorageKey = "supportai:visitor-session:" + assistantId;
  function createVisitorSessionToken() {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
  }
  let visitorSessionToken = "";
  try {
    visitorSessionToken = window.sessionStorage.getItem(sessionStorageKey) || "";
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(visitorSessionToken)) {
      visitorSessionToken = createVisitorSessionToken();
      window.sessionStorage.setItem(sessionStorageKey, visitorSessionToken);
    }
  } catch { /* Privacy-restricted storage falls back to an in-memory visitor session. */
    visitorSessionToken = createVisitorSessionToken();
  }
  const maxMessageLength = 8000;
  const requestTimeoutMs = 30000;
  const maxRetryAfterSeconds = 300;
  const pendingRequests = new Set();
  const debugWidget = (stage, details) => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.debug("[SupportAI widget] " + stage, details);
    }
  };
  function publicErrorForStatus(status) {
    if (status === 400 || status === 413) return "Please check your message and try again.";
    if (status === 403) return "This assistant is not available from this website.";
    if (status === 404) return "This assistant could not be found.";
    if (status === 429) return "Too many requests. Please wait before trying again.";
    return "SupportAI is temporarily unavailable. Please try again later.";
  }
  function publicLeadErrorForStatus(status) {
    if (status === 400 || status === 413) return "Please check your details and try again.";
    if (status === 403) return "Lead submission is unavailable from this website.";
    if (status === 429) return "Please wait a moment before trying again.";
    return "Lead submission is temporarily unavailable. Please try again.";
  }
  const mount = document.createElement("div");
  mount.setAttribute("data-supportai-widget", "");
  document.body.appendChild(mount);
  const root = mount.attachShadow({ mode: "open" });

  root.innerHTML = \`
    <style>
      :host { all: initial; }
      .launcher {
        position: fixed; right: 22px; bottom: 22px; z-index: 2147483647;
        width: 58px; height: 58px; border: 0; border-radius: 50%;
        background: var(--brand-color, #236b5b); color: var(--brand-text-color, #fff); cursor: pointer;
        box-shadow: 0 10px 28px rgba(15, 23, 42, .22);
        font: 25px/58px system-ui, sans-serif;
        text-align: center;
      }
      .launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
      .frame {
        position: fixed; right: 22px; bottom: 92px; z-index: 2147483647;
        width: min(380px, calc(100vw - 28px)); height: min(600px, calc(100vh - 120px));
        border: 0; border-radius: 18px; background: white;
        box-shadow: 0 20px 60px rgba(15, 23, 42, .2);
        transition: opacity 120ms, transform 120ms;
      }
      [hidden] { display: none !important; }
      @media (max-width: 480px) {
        /* On mobile the panel covers the full screen */
        .launcher { right: 16px; bottom: 16px; }
        .frame {
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
          bottom: 0;
        }
      }
    </style>
    <button class="launcher" type="button" aria-label="Open support chat" aria-expanded="false">\u{1F4AC}</button>
    <iframe class="frame" title="Support chat" hidden allow="clipboard-write"></iframe>
  \`;

  const launcher = root.querySelector(".launcher");
  const frame = root.querySelector(".frame");
  if (!(launcher instanceof HTMLButtonElement) || !(frame instanceof HTMLIFrameElement)) return;

  let brand = {
    color: "#236b5b",
    textColor: "#ffffff",
    linkColor: "#236b5b",
  };
  let frameReady = false;
  const sendBrandToFrame = () => {
    frame.contentWindow?.postMessage({
      type: "supportai:brand-config",
      brand_color: brand.color,
      brand_text_color: brand.textColor,
      brand_link_color: brand.linkColor,
    }, appOrigin);
  };

  fetch(appOrigin + "/api/public/assistant-config?assistant_id=" + encodeURIComponent(assistantId), {
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  }).then((response) => response.ok ? response.json() : null).then((config) => {
    if (!isVerificationConfigReady(config)) {
      debugWidget("configuration-not-ready", {});
      return;
    }
    brand = {
      color: config.brand_color.toLowerCase(),
      textColor: config.brand_text_color.toLowerCase(),
      linkColor: config.brand_link_color.toLowerCase(),
    };
    mount.style.setProperty("--brand-color", brand.color);
    mount.style.setProperty("--brand-text-color", brand.textColor);
    if (frameReady) sendBrandToFrame();
    if (typeof verificationToken === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(verificationToken)) {
      void fetch(appOrigin + "${INSTALLATION_VERIFY_PATH}", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_id: assistantId, token: verificationToken }),
      }).then((response) => {
        debugWidget("installation-verification-response", { status: response.status });
      }).catch(() => {
        debugWidget("installation-verification-unreachable", {});
      });
    }
  }).catch(() => {});

  frame.src = appOrigin + "/widget-frame?assistant_id=" + encodeURIComponent(assistantId) +
    "&parent_origin=" + encodeURIComponent(window.location.origin);

  function openWidget() {
    frame.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close support chat");
    frame.focus();
  }

  function closeWidget() {
    frame.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open support chat");
    launcher.focus();
  }

  launcher.addEventListener("click", () => {
    if (frame.hidden) { openWidget(); } else { closeWidget(); }
  });

  async function handleChatRequest(event) {
    debugWidget("parent-message-received", {
      type: event.data && typeof event.data === "object" ? event.data.type || "unknown" : "invalid",
    });
    if (event.source !== frame.contentWindow || event.origin !== appOrigin) return;
    const data = event.data;
    if (
      typeof data !== "object" ||
      data === null ||
      Array.isArray(data) ||
      (data.type !== "supportai:chat-request" &&
        data.type !== "supportai:restore-request" &&
        data.type !== "supportai:handoff-request" &&
        data.type !== "supportai:lead-request" &&
        data.type !== "supportai:handoff-poll")
    ) return;
    if (
      typeof data.requestId !== "string" ||
      data.requestId.length === 0 ||
      data.requestId.length > 128 ||
      pendingRequests.has(data.requestId)
    ) return;
    if (data.type === "supportai:chat-request" &&
      (typeof data.message !== "string" || !data.message.trim() || data.message.length > maxMessageLength)) return;
    if (data.type === "supportai:handoff-request" &&
      (typeof data.reason !== "string" || !data.reason.trim() || data.reason.length > 2000 ||
        !Array.isArray(data.transcript) || data.transcript.length > 50)) return;
    if (data.type === "supportai:lead-request" &&
      (typeof data.name !== "string" || typeof data.email !== "string" || typeof data.question !== "string" ||
        !data.name.trim() || !data.email.trim() || !data.question.trim() ||
        data.name.length > 120 || data.email.length > 254 || data.question.length > 5000)) return;
    if (data.type === "supportai:handoff-poll" &&
      (typeof data.handoffId !== "string" || typeof data.accessToken !== "string" ||
        data.handoffId.length > 100 || data.accessToken.length > 200)) return;

    const requestId = data.requestId;
    const isChat = data.type === "supportai:chat-request";
    const isRestore = data.type === "supportai:restore-request";
    const isHandoff = data.type === "supportai:handoff-request";
    const isLead = data.type === "supportai:lead-request";
    pendingRequests.add(requestId);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      debugWidget("fetch-dispatch", { type: data.type, requestId });
      const response = await fetch(
        isChat || isRestore
          ? appOrigin + "/api/public/chat"
          : isHandoff
            ? appOrigin + "/api/public/handoff"
            : isLead
              ? appOrigin + "/api/leads"
            : appOrigin + "/api/public/handoff?handoff_id=" +
              encodeURIComponent(data.handoffId) + "&access_token=" +
              encodeURIComponent(data.accessToken),
        {
          method: isChat || isRestore || isHandoff || isLead ? "POST" : "GET",
          headers: isChat || isRestore || isHandoff || isLead ? { "Content-Type": "application/json" } : undefined,
          body: isChat || isRestore
            ? JSON.stringify({
                assistant_id: assistantId,
                session_token: visitorSessionToken,
                ...(isRestore ? { action: "restore" } : { message: data.message.trim(), request_id: data.requestId }),
              })
            : isHandoff
              ? JSON.stringify({
                  assistant_id: assistantId,
                  customer_name: data.customerName,
                  customer_email: data.customerEmail,
                  reason: data.reason,
                  transcript: data.transcript,
                  session_token: visitorSessionToken,
                  conversation_id: data.conversationId,
                })
              : isLead
                ? JSON.stringify({
                    assistant_id: assistantId,
                    name: data.name.trim(),
                    email: data.email.trim(),
                    question: data.question.trim(),
                  })
              : undefined,
          signal: controller.signal,
        },
      );
      if (isChat && response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("The SupportAI response stream is unavailable.");
        const decoder = new TextDecoder();
        let buffer = "";
        let sawComplete = false;
        const forwardEvent = (block) => {
          if (!block.trim()) return;
          let eventName = "message";
          const dataLines = [];
          for (const line of block.split("\\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
          }
          if (!dataLines.length) return;
          let payload;
          try { payload = JSON.parse(dataLines.join("\\n")); }
          catch { throw new Error("SupportAI returned a malformed stream event."); }
          if (eventName === "delta" && typeof payload?.text === "string") {
            frame.contentWindow?.postMessage({ type: "supportai:chat-stream", requestId, event: "delta", payload }, appOrigin);
          } else if (eventName === "complete" && payload && typeof payload === "object") {
            sawComplete = true;
            frame.contentWindow?.postMessage({ type: "supportai:chat-stream", requestId, event: "complete", payload }, appOrigin);
          } else if (eventName === "error") {
            frame.contentWindow?.postMessage({ type: "supportai:chat-stream", requestId, event: "error", payload: { message: typeof payload?.message === "string" ? payload.message : "The assistant response could not be completed." } }, appOrigin);
          } else {
            throw new Error("SupportAI returned an unsupported stream event.");
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\\n\\n");
          buffer = blocks.pop() || "";
          for (const block of blocks) forwardEvent(block);
        }
        buffer += decoder.decode();
        if (buffer.trim()) forwardEvent(buffer);
        if (!sawComplete) throw new Error("The SupportAI response ended before it was saved.");
        return;
      }
      let payload;
      let validJson = true;
      try {
        payload = await response.json();
      } catch {
        validJson = false;
        payload = { error: "The SupportAI service returned an invalid response." };
      }

      if (
        !response.ok ||
        !validJson ||
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload)
      ) {
        payload = isLead
          ? response.ok
            ? { code: "LEAD_RESPONSE_INVALID", message: publicLeadErrorForStatus(response.status) }
            : {
                code: typeof payload?.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(payload.code)
                  ? payload.code
                  : response.status === 502 ? "LEAD_DELIVERY_FAILED" : response.status === 503 ? "LEAD_SERVICE_UNAVAILABLE" : response.status === 504 ? "LEAD_DELIVERY_TIMEOUT" : "LEAD_SUBMISSION_FAILED",
                message: typeof payload?.message === "string" && payload.message.length <= 240
                  ? payload.message
                  : publicLeadErrorForStatus(response.status),
              }
          : { error: publicErrorForStatus(response.status) };
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMatch = retryAfterHeader?.trim().match(/^\\d+$/);
      const retryAfterNumber = retryAfterMatch ? Number(retryAfterMatch[0]) : null;
      const retryAfterSeconds = Number.isSafeInteger(retryAfterNumber)
        ? Math.min(retryAfterNumber, maxRetryAfterSeconds)
        : null;
      debugWidget("fetch-response", { type: data.type, requestId, status: response.status });

      if (frame.contentWindow) {
        frame.contentWindow.postMessage(
          {
            type: isChat ? "supportai:chat-response" : isRestore ? "supportai:restore-response" : isLead ? "supportai:lead-response" : "supportai:handoff-response",
            requestId,
            ok: response.ok && validJson,
            ...(response.ok && validJson
              ? { payload }
              : {
                  error: isLead ? payload.message : payload.error,
                  ...(isLead && typeof payload.code === "string" ? { code: payload.code } : {}),
                  status: response.status,
                  ...(response.status === 429 ? { retryAfterSeconds } : {}),
                }),
          },
          appOrigin,
        );
      }
    } catch (error) {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage(
          {
            type: isChat ? "supportai:chat-response" : isRestore ? "supportai:restore-response" : isLead ? "supportai:lead-response" : "supportai:handoff-response",
            requestId,
            ok: false,
            ...(isLead ? { code: error?.name === "AbortError" ? "LEAD_API_TIMEOUT" : "LEAD_API_UNREACHABLE" } : {}),
            error: error?.name === "AbortError"
              ? "The SupportAI request timed out."
              : isLead ? "Lead submission could not reach SupportAI. Please try again later." : "Unable to reach SupportAI right now.",
          },
          appOrigin,
        );
      }
    } finally {
      window.clearTimeout(timeout);
      pendingRequests.delete(requestId);
    }
  }

  // Handle messages from iframe or host page
  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow || event.origin !== appOrigin) return;
    if (event.data && event.data.type === "supportai:rotate-visitor-session") {
      visitorSessionToken = createVisitorSessionToken();
      try { window.sessionStorage.setItem(sessionStorageKey, visitorSessionToken); } catch { /* Keep reset session in memory. */ }
      frame.contentWindow?.postMessage({ type: "supportai:reset-session" }, appOrigin);
      return;
    }
    if (event.data && event.data.type === "supportai:ready") {
      frameReady = true;
      sendBrandToFrame();
      return;
    }
    if (event.data && event.data.type === "supportai:close") {
      closeWidget();
      return;
    }
    void handleChatRequest(event);
  });
})();`;

export function GET() {
  return new Response(widgetScript, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
