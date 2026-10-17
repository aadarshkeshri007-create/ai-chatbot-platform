import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: [
        "pdf-parse",
        "@napi-rs/canvas",
    ],
    allowedDevOrigins: ["192.168.137.1"]
};

export default nextConfig;