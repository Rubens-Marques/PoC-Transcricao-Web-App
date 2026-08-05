import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: without this, Turbopack walks up and can pick a
  // lockfile from an ancestor directory outside the project.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // Emits .next/standalone with a self-contained server.js — what the Docker
  // runner stage copies instead of shipping node_modules.
  output: "standalone",
};

export default nextConfig;
