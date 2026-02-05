const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "src", "preload.cjs");
const targetDir = path.join(root, "dist");
const target = path.join(targetDir, "preload.cjs");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
