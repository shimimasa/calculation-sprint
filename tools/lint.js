#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const roots = ["src", "scripts", "tools"];
const allowedExtensions = new Set([".js", ".mjs"]);
const ignoreDirs = new Set(["node_modules", ".git"]);

const files = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }
    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) {
    walk(root);
  }
}

if (files.length === 0) {
  console.log("[lint] No JavaScript files found to check.");
  process.exit(0);
}

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[lint] Syntax check failed for ${file}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[lint] Syntax check passed for ${files.length} file(s).`);
