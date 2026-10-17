const widgetScript = `(() => {
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
        background: #2563eb; color: white; cursor: pointer;
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
        data.type !== "supportai:handoff-request" &&
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
    if (data.type === "supportai:handoff-poll" &&
      (typeof data.handoffId !== "string" || typeof data.accessToken !== "string" ||
        data.handoffId.length > 100 || data.accessToken.length > 200)) return;

    const requestId = data.requestId;
    const isChat = data.type === "supportai:chat-request";
    const isHandoff = data.type === "supportai:handoff-request";
    pendingRequests.add(requestId);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      debugWidget("fetch-dispatch", { type: data.type, requestId });
      const response = await fetch(
        isChat
          ? appOrigin + "/api/public/chat"
          : isHandoff
            ? appOrigin + "/api/public/handoff"
            : appOrigin + "/api/public/handoff?handoff_id=" +
              encodeURIComponent(data.handoffId) + "&access_token=" +
              encodeURIComponent(data.accessToken),
        {
          method: isChat ? "POST" : isHandoff ? "POST" : "GET",
          headers: isChat || isHandoff ? { "Content-Type": "application/json" } : undefined,
          body: isChat
            ? JSON.stringify({ assistant_id: assistantId, message: data.message.trim() })
            : isHandoff
              ? JSON.stringify({
                  assistant_id: assistantId,
                  customer_name: data.customerName,
                  customer_email: data.customerEmail,
                  reason: data.reason,
                  transcript: data.transcript,
                })
              : undefined,
          signal: controller.signal,
        },
      );
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
        payload = {
          error: publicErrorForStatus(response.status),
        };
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
            type: isChat ? "supportai:chat-response" : "supportai:handoff-response",
            requestId,
            ok: response.ok && validJson,
            ...(response.ok && validJson
              ? { payload }
              : {
                  error: payload.error,
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
          type: isChat ? "supportai:chat-response" : "supportai:handoff-response",
            requestId,
            ok: false,
            error: error?.name === "AbortError"
              ? "The SupportAI request timed out."
              : "Unable to reach SupportAI right now.",
          },
          appOrigin,
        );
      }
    } finally {
      window.clearTimeout(timeout);
      pendingRequests.delete(requestId);
    }
  }

  // Handle close message from the iframe's × button
  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow || event.origin !== appOrigin) return;
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
