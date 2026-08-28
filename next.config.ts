import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  agentRules: false,
};

export default nextConfig;
