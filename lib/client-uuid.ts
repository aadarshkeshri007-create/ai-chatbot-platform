const UUID_GENERATION_ERROR =
    "Unable to create a secure identifier in this browser. Please use a supported browser.";

/**
 * Creates an RFC 4122 version 4 UUID for use in browser-generated IDs.
 *
 * randomUUID is preferred when the browser exposes it. getRandomValues is
 * supported in more browser contexts, including non-secure local HTTP origins.
 */
export function generateClientUuid(): string {
    const cryptoApi = globalThis.crypto;

    if (!cryptoApi) {
        throw new Error(UUID_GENERATION_ERROR);
    }

    if (typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    if (typeof cryptoApi.getRandomValues !== "function") {
        throw new Error(UUID_GENERATION_ERROR);
    }

    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join("-");
}
