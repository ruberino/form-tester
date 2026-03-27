const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(process.cwd(), "form-tester.config.json");
const OUTPUT_BASE = path.resolve(process.cwd(), "output");
const ISSUES_PATH = path.join(OUTPUT_BASE, "issues.jsonl");
const LOCAL_VERSION = "0.13.0";
const RECOMMENDED_PERSON = "Uromantisk Direktør";

const DEFAULT_CONFIG = {
  pnr: "",
  person: "",
  baseUrl: "",
  skjemaUrl: "/skjemautfyller",
  dokumenterUrlTemplate: "/dokumenter?pnr={PNR}",
  lastTestUrl: "",
  lastRunDir: "",
  lastSeenVersion: "",
  lastPerson: "",
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
  CONFIG_PATH,
  OUTPUT_BASE,
  ISSUES_PATH,
  LOCAL_VERSION,
  RECOMMENDED_PERSON,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
};
