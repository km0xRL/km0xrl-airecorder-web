import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [],
  images: { unoptimized: true },
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*"],
  },
  outputFileTracingExcludes: {
    "*": [
      "./data/**/*",
      "./docs/**/*",
      "./screenshots/**/*",
      "./tests/**/*",
      "./scripts/**/*",
      "./.git/**/*",
      "./app/**/*",
      "./components/**/*",
      "./lib/**/*",
      "./public/**/*",
      "./node_modules/.pnpm/@img+*/**/*",
      "./node_modules/.pnpm/sharp@*/**/*",
      "./node_modules/.pnpm/vitest@*/**/*",
      "./node_modules/.pnpm/typescript@*/**/*",
      "./node_modules/.pnpm/tailwindcss@*/**/*",
      "./node_modules/.pnpm/@tailwindcss+*/**/*",
      "./node_modules/.pnpm/esbuild@*/**/*",
      "./node_modules/.pnpm/playwright-core@*/**/*",
    ],
  },
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      // no-referrer заставляет Chrome отправлять Origin: null на form POST и ломает вход.
      // same-origin не отдаёт реферер наружу, но сохраняет корректный Origin для своих форм.
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
