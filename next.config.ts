import type { NextConfig } from "next";

// Do not import src/lib/env here.
// Next loads next.config.ts before the application build starts, so importing
// strict runtime environment validation from this file makes deploys fail when
// optional/live-service secrets are not yet configured. Runtime code and the
// commercial readiness check still validate required secrets where appropriate.
const nextConfig: NextConfig = {};

export default nextConfig;
