const fs = require("fs");
const readline = require("readline");

let rl = null;

function ensureReadline() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "form-tester> ",
    });
  }
  return rl;
}

function ask(question) {
  return new Promise((resolve) => {
    const currentRl = ensureReadline();
    currentRl.question(question, (answer) => resolve(answer.trim()));
  });
}

function normalizeLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
}

function extractResultBlock(output) {
  const lines = output.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "### Result");
  if (start < 0) return null;
  const collected = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().startsWith("###")) break;
    if (line.trim()) collected.push(line);
  }
  return collected.join("\n").trim();
}

function sanitizeSegment(value) {
  return value.replace(/[<>:"/\\|?*]+/g, "").trim() || "FORM";
}

function clearConsole() {
  if (typeof console.clear === "function") {
    console.clear();
  } else {
    process.stdout.write("\x1Bc");
  }
}

function copyDirSync(src, dest) {
  const path = require("path");
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function findRepoRoot(startDir) {
  const path = require("path");
  let current = startDir;
  while (true) {
    const gitPath = path.join(current, ".git");
    if (fs.existsSync(gitPath)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function sanitizePersonOptions(list) {
  const normalized = list
    .map(normalizeLabel)
    .filter(Boolean)
    .filter((item) => item.length <= 60);
  const seen = new Set();
  return normalized.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prioritizeRecommended(list, recommendedLabel) {
  const recommended = normalizeLabel(recommendedLabel).toLowerCase();
  const preferred = [];
  const rest = [];
  for (const item of list) {
    if (item.toLowerCase() === recommended) {
      preferred.push(item);
    } else {
      rest.push(item);
    }
  }
  return [...preferred, ...rest];
}

function parsePersonList(output) {
  const resultBlock = extractResultBlock(output);
  const source = resultBlock || output;
  const json = extractJsonArray(source);
  if (json) return sanitizePersonOptions(json);
  return sanitizePersonOptions(source.split(/\r?\n/));
}

module.exports = {
  ensureReadline,
  ask,
  normalizeLabel,
  sleep,
  extractJsonArray,
  extractResultBlock,
  sanitizeSegment,
  clearConsole,
  copyDirSync,
  findRepoRoot,
  sanitizePersonOptions,
  prioritizeRecommended,
  parsePersonList,
};
