import { defineConfig } from "tsup";

export default defineConfig([
  // Core (framework-neutral)
  {
    entry: { "core/index": "src/core/index.ts" },
    format: ["esm"],
    dts: true,
    outDir: "dist",
    target: "es2022",
    splitting: false,
    clean: true,
    external: ["react", "react-dom", "preact", "preact/hooks", "preact/jsx-runtime"],
  },
  // React subpath
  {
    entry: { "react/index": "src/react/index.tsx" },
    format: ["esm"],
    dts: true,
    outDir: "dist",
    target: "es2022",
    splitting: false,
    external: ["react", "react-dom", "preact", "preact/hooks", "preact/jsx-runtime"],
    esbuildOptions(opts) {
      opts.jsx = "automatic";
      opts.jsxImportSource = "react";
    },
  },
  // Preact subpath
  {
    entry: { "preact/index": "src/preact/index.tsx" },
    format: ["esm"],
    dts: true,
    outDir: "dist",
    target: "es2022",
    splitting: false,
    external: ["react", "react-dom", "preact", "preact/hooks", "preact/jsx-runtime"],
    esbuildOptions(opts) {
      opts.jsx = "automatic";
      opts.jsxImportSource = "preact";
    },
  },
  // CSS — copy as-is
  {
    entry: { "demo-studio": "src/styles/demo-studio.css" },
    outDir: "dist",
  },
]);
