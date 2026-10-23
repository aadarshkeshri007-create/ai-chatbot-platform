"use client";

import { useEffect, useState } from "react";

export default function WidgetPreviewHost({ assistantId }: { assistantId: string }) {
  const [status, setStatus] = useState("Loading the embedded widget preview…");
  const validAssistantId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assistantId);

  useEffect(() => {
    if (!validAssistantId) return;
    const script = document.createElement("script");
    script.src = `${window.location.origin}/widget.js`;
    script.dataset.assistantId = assistantId;
    script.defer = true;
    script.onload = () => setStatus("Live widget preview");
    script.onerror = () => setStatus("Unable to load the widget script.");
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.querySelector('[data-supportai-widget]')?.remove();
    };
  }, [assistantId, validAssistantId]);

  return <main className="min-h-screen bg-[var(--background)] p-4 text-sm text-[var(--text-primary)] dark:bg-[var(--background)] dark:text-[var(--text-primary)]">{validAssistantId ? status : "A valid Assistant ID is required for this preview."}</main>;
}
