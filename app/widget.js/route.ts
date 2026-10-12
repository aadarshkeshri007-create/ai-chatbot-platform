const widgetScript = `(() => {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return;

  const assistantId = script.dataset.assistantId;
  if (!assistantId) {
    console.error("SupportAI widget: data-assistant-id is required.");
    return;
  }

  const appOrigin = new URL(script.src, window.location.href).origin;
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
        font: 25px/1 system-ui, sans-serif;
      }
      .launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
      .frame {
        position: fixed; right: 22px; bottom: 92px; z-index: 2147483647;
        width: min(380px, calc(100vw - 28px)); height: min(600px, calc(100vh - 120px));
        border: 0; border-radius: 18px; background: white;
        box-shadow: 0 20px 60px rgba(15, 23, 42, .2);
      }
      [hidden] { display: none !important; }
      @media (max-width: 480px) {
        .launcher { right: 16px; bottom: 16px; }
        .frame { right: 10px; bottom: 86px; width: calc(100vw - 20px); height: min(600px, calc(100vh - 104px)); }
      }
    </style>
    <button class="launcher" type="button" aria-label="Open support chat" aria-expanded="false">💬</button>
    <iframe class="frame" title="Support chat" hidden></iframe>
  \`;

  const launcher = root.querySelector(".launcher");
  const frame = root.querySelector(".frame");
  if (!(launcher instanceof HTMLButtonElement) || !(frame instanceof HTMLIFrameElement)) return;

  frame.src = appOrigin + "/widget-frame?assistant_id=" + encodeURIComponent(assistantId);
  launcher.addEventListener("click", () => {
    const open = frame.hidden;
    frame.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "Close support chat" : "Open support chat");
    if (open) frame.focus();
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
