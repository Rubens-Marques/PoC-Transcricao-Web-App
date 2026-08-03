import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: without this, Turbopack walks up and can pick a
  // lockfile from an ancestor directory outside the project.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
