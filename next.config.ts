import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: [
        "pdf-parse",
        "@napi-rs/canvas",
    ],
    allowedDevOrigins: ["10.56.171.229"]
};

export default nextConfig;