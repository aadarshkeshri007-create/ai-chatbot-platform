function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendHandoffNotification(input: {
  ownerEmail: string;
  businessName: string;
  customerName: string | null;
  customerEmail: string | null;
  reason: string;
  latestMessage: string | null;
  handoffId: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.SUPPORTAI_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.warn("[handoff-email] email-not-configured");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const inboxUrl = `${appUrl}/handoffs`;
  const customer = input.customerName || "A website visitor";
  const message = input.latestMessage || "No latest message was provided.";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.ownerEmail],
      subject: `New SupportAI handoff for ${input.businessName}`,
      html: `
        <h2>New support request</h2>
        <p><strong>Customer:</strong> ${escapeHtml(customer)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.customerEmail || "Not provided")}</p>
        <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
        <p><strong>Latest message:</strong> ${escapeHtml(message)}</p>
        <p><a href="${escapeHtml(inboxUrl)}">Open the SupportAI inbox</a></p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error("email-delivery-failed");
  }
}
