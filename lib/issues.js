const fs = require("fs");
const path = require("path");
const { ISSUES_PATH, CONFIG_PATH, LOCAL_VERSION } = require("./config");

const ISSUE_CATEGORIES = [
  "person-selection",
  "navigation",
  "form-fill",
  "submission",
  "documents",
  "pdf-download",
  "html-capture",
  "screenshot",
  "snapshot",
  "validation",
  "modal",
  "timeout",
  "other",
];

function logIssue(category, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    version: LOCAL_VERSION,
    category,
    message,
    ...context,
  };

  // Append to global issues log
  fs.mkdirSync(path.dirname(ISSUES_PATH), { recursive: true });
  fs.appendFileSync(ISSUES_PATH, JSON.stringify(entry) + "\n");

  // Also append to current run dir if available
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (config.lastRunDir && fs.existsSync(config.lastRunDir)) {
      const runIssuesPath = path.join(config.lastRunDir, "issues.jsonl");
      fs.appendFileSync(runIssuesPath, JSON.stringify(entry) + "\n");
    }
  } catch (e) {
    // no config or run dir, global log is enough
  }

  return entry;
}

function listIssues(limit = 20) {
  if (!fs.existsSync(ISSUES_PATH)) return [];
  const lines = fs
    .readFileSync(ISSUES_PATH, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  const issues = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return issues.slice(-limit);
}

function formatIssue(issue) {
  const time = issue.timestamp
    ? issue.timestamp.replace("T", " ").replace(/\.\d+Z$/, "")
    : "?";
  const url = issue.url ? ` | ${issue.url}` : "";
  const formId = issue.formId ? ` | ${issue.formId}` : "";
  return `[${time}] [${issue.category}]${formId}${url}\n  ${issue.message}`;
}

module.exports = {
  ISSUE_CATEGORIES,
  logIssue,
  listIssues,
  formatIssue,
};
