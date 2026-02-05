#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const steps = [
  { name: "lint", command: process.execPath, args: ["tools/lint.js"] },
  { name: "build", command: process.execPath, args: ["tools/build.js"] }
];

for (const step of steps) {
  console.log(`\n[gate-ci] ${step.name}`);
  const result = spawnSync(step.command, step.args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[gate-ci] ${step.name} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[gate-ci] All checks passed.");
