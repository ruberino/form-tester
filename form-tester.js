#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn, execSync } = require("child_process");

const CONFIG_PATH = path.join(process.cwd(), "form-tester.config.json");
const OUTPUT_BASE = path.resolve(process.cwd(), "output");
const LOCAL_VERSION = "0.6.0";
const RECOMMENDED_PERSON = "Uromantisk Direktør";

// Recording state — when active, all playwright-cli commands are logged
let activeRecording = null;

function startRecording(outputDir) {
  activeRecording = { commands: [], outputDir, startedAt: new Date().toISOString() };
}

function recordCommand(args) {
  if (activeRecording) {
    activeRecording.commands.push({ args, timestamp: new Date().toISOString() });
  }
}

function saveRecording() {
  if (!activeRecording || !activeRecording.commands.length) return null;
  const filePath = path.join(activeRecording.outputDir, "recording.json");
  const data = {
    version: LOCAL_VERSION,
    startedAt: activeRecording.startedAt,
    completedAt: new Date().toISOString(),
    commandCount: activeRecording.commands.length,
    commands: activeRecording.commands,
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  activeRecording = null;
  return filePath;
}

function stopRecording() {
  activeRecording = null;
}

const PERSONAS = [
  {
    id: "ung-mann",
    name: "Ung mann",
    description: "25 år, frisk, ingen medisiner, aktiv livsstil",
    traits: {
      gender: "Mann",
      age: 25,
      smoker: false,
      alcohol: "0-5",
      medications: false,
      allergies: false,
      previousConditions: false,
      exercise: "3-4",
      pregnant: false,
    },
  },
  {
    id: "gravid-kvinne",
    name: "Gravid kvinne",
    description: "32 år, frisk, førstegangsfødende, samboer, yrkesaktiv",
    traits: {
      gender: "Kvinne",
      age: 32,
      smoker: false,
      alcohol: "none",
      medications: false,
      allergies: false,
      previousConditions: false,
      exercise: "1-2",
      pregnant: true,
      firstPregnancy: true,
    },
  },
  {
    id: "eldre-kvinne",
    name: "Eldre kvinne",
    description: "68 år, overgangsalder, tar D-vitamin, lett vektnedgang",
    traits: {
      gender: "Kvinne",
      age: 68,
      smoker: false,
      alcohol: "0-5",
      medications: true,
      allergies: false,
      previousConditions: false,
      exercise: "1-2",
      pregnant: false,
      menopause: true,
    },
  },
  {
    id: "kronisk-syk",
    name: "Kronisk syk mann",
    description: "45 år, diabetes type 2, faste medisiner, røykt tidligere",
    traits: {
      gender: "Mann",
      age: 45,
      smoker: "previously",
      alcohol: "5-10",
      medications: true,
      allergies: true,
      previousConditions: true,
      exercise: "0",
      pregnant: false,
    },
  },
];

function getPersonas() {
  return PERSONAS;
}

function getPersonaById(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}

function formatPersonaList() {
  const lines = PERSONAS.map(
    (p, i) => `  ${i + 1}. ${p.name} — ${p.description}`,
  );
  lines.push(`  ${PERSONAS.length + 1}. Noen — tilfeldig / nøytrale svar`);
  lines.push(`  ${PERSONAS.length + 2}. Lag egen — beskriv persona selv`);
  return lines.join("\n");
}

async function promptScenario() {
  console.log("\nTestscenario (beskriv hva du vil teste, eller trykk Enter for standard test):");
  const answer = await ask("Scenario: ");
  const trimmed = (answer || "").trim();
  if (!trimmed) {
    console.log("Scenario: Standard test — ren utfylling og innsending.");
    return { type: "default", description: "Standard test" };
  }
  console.log(`Scenario: ${trimmed}`);
  return { type: "custom", description: trimmed };
}

async function promptPersona(config) {
  console.log("\nVelg persona for utfylling:");
  console.log(formatPersonaList());
  const answer = await ask(
    `Velg (1-${PERSONAS.length + 2}): `,
  );
  const idx = Number.parseInt(answer, 10);
  if (idx >= 1 && idx <= PERSONAS.length) {
    const persona = PERSONAS[idx - 1];
    console.log(`Persona: ${persona.name} — ${persona.description}`);
    config.lastPersona = persona.id;
    saveConfig(config);
    return { type: "preset", persona };
  }
  if (idx === PERSONAS.length + 1) {
    console.log("Persona: Noen — nøytrale svar");
    config.lastPersona = "noen";
    saveConfig(config);
    return { type: "noen", persona: null };
  }
  if (idx === PERSONAS.length + 2) {
    const description = await ask("Beskriv persona: ");
    console.log(`Persona: Egendefinert — ${description}`);
    config.lastPersona = "custom";
    saveConfig(config);
    return { type: "custom", description };
  }
  console.log("Ugyldig valg, bruker 'Noen'.");
  config.lastPersona = "noen";
  saveConfig(config);
  return { type: "noen", persona: null };
}
const DEFAULT_CONFIG = {
  pnr: "",
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

function resolveDokumenterUrl(config) {
  if (!config.dokumenterUrlTemplate) return "";
  if (config.dokumenterUrlTemplate.includes("{PNR}")) {
    if (!config.pnr) return "";
    return config.dokumenterUrlTemplate.replace("{PNR}", config.pnr);
  }
  return config.dokumenterUrlTemplate;
}

function extractPnrFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("pnr") || "";
  } catch (err) {
    return "";
  }
}

function setPnrOnUrl(url, pnr) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("pnr", pnr);
    return parsed.toString();
  } catch (err) {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}pnr=${encodeURIComponent(pnr)}`;
  }
}

async function ensurePnrInUrl(url, config, ask) {
  const existing = extractPnrFromUrl(url);
  if (existing) {
    config.pnr = existing;
    saveConfig(config);
    return { url, pnr: existing };
  }
  const answer = await ask("PNR (required because URL lacks pnr=): ");
  const pnr = answer || config.pnr;
  if (!pnr) return { url: "", pnr: "" };
  const updatedUrl = setPnrOnUrl(url, pnr);
  config.pnr = pnr;
  saveConfig(config);
  return { url: updatedUrl, pnr };
}

function extractFormId(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("skjemautfyller");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] || "FORM";
  } catch (err) {
    return "FORM";
  }
}

function sanitizeSegment(value) {
  return value.replace(/[<>:"/\\|?*]+/g, "").trim() || "FORM";
}

function getPlaywrightCommand() {
  if (process.platform === "win32") {
    try {
      const output = execSync(
        "Get-Command playwright-cli -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path",
        { stdio: ["ignore", "pipe", "ignore"], shell: "powershell" },
      )
        .toString()
        .trim();
      if (output) {
        if (output.toLowerCase().endsWith(".ps1")) {
          const cmdPath = output.replace(/\.ps1$/i, ".cmd");
          if (fs.existsSync(cmdPath)) return cmdPath;
        }
        return output;
      }
    } catch (err) {
      // fall through to default
    }
  }
  return "playwright-cli";
}

function isPlaywrightCliAvailable() {
  if (process.platform === "win32") {
    try {
      const output = execSync(
        "Get-Command playwright-cli -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path",
        { stdio: ["ignore", "pipe", "ignore"], shell: "powershell" },
      )
        .toString()
        .trim();
      return Boolean(output);
    } catch (err) {
      return false;
    }
  }
  try {
    execSync("command -v playwright-cli", {
      stdio: ["ignore", "ignore", "ignore"],
      shell: true,
    });
    return true;
  } catch (err) {
    return false;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", (err) => {
      console.error(`Failed to launch ${command}: ${err.message}`);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

function runPlaywrightCli(args) {
  recordCommand(args);
  return new Promise((resolve) => {
    const spec = getPlaywrightCommandSpec();
    const spawnOpts = { stdio: "inherit" };
    if (spec.shell) spawnOpts.shell = true;
    const child = spawn(spec.command, [...spec.args, ...args], spawnOpts);
    child.on("error", (err) => {
      console.error(`Failed to launch ${spec.command}: ${err.message}`);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

function runPlaywrightCliCapture(args) {
  return new Promise((resolve) => {
    const spec = getPlaywrightCommandSpec();
    const captureOpts = { stdio: ["ignore", "pipe", "pipe"] };
    if (spec.shell) captureOpts.shell = true;
    const child = spawn(
      spec.command,
      [...spec.args, ...args],
      captureOpts,
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (err) => {
      resolve({ code: 1, stdout: "", stderr: err.message });
    });
    child.on("exit", (code) =>
      resolve({
        code: code ?? 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      }),
    );
  });
}

function getPlaywrightCommandSpec() {
  const command = getPlaywrightCommand();
  const lower = command.toLowerCase();
  if (process.platform === "win32" && (lower.endsWith(".cmd") || lower.endsWith(".ps1"))) {
    // Try to resolve the actual .js entry point to avoid shell/spawn issues
    const nodeDir = path.dirname(command);
    const cliPath = path.join(
      nodeDir,
      "node_modules",
      "@playwright",
      "cli",
      "playwright-cli.js",
    );
    if (fs.existsSync(cliPath)) {
      return { command: process.execPath, args: [cliPath], shell: false };
    }
    // Fallback: run via node process.execPath with the .cmd/.ps1 content
    return { command, args: [], shell: true };
  }
  return { command, args: [], shell: false };
}

function findRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    const gitPath = path.join(current, ".git");
    if (fs.existsSync(gitPath)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

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

function clearConsole() {
  if (typeof console.clear === "function") {
    console.clear();
  } else {
    process.stdout.write("\x1Bc");
  }
}

function printHelp() {
  console.log(
    [
      "Commands:",
      "  /setup                      Install Playwright CLI + skills if missing",
      "  /update                     Update repo (if git), Playwright CLI, and skills",
      "  /version                    Show local skill version",
      "  /people                     Scan visible person list and prompt selection",
      "  /persona                    List available personas",
      "  /test {url}                 Open form URL with Playwright CLI and save initial artifacts",
      "  /save {label}               Save snapshot + screenshot to last output folder",
      "  /clear                      Clear the console",
      "  /help                       Show this help",
      "  /exit                       Exit the app",
      "  /quit                       Exit the app",
    ].join("\n"),
  );
}

function printVersion(config) {
  const saved = config.lastSeenVersion || "unknown";
  console.log(`Local version: ${LOCAL_VERSION}`);
  console.log(`Saved version: ${saved}`);
}

function printNextSteps(outputDir, dokumenterUrl) {
  console.log("");
  console.log("Next steps (manual Playwright CLI):");
  console.log('- Accept cookies if prompted.');
  console.log('- Use the person selection prompt to choose the correct person.');
  console.log('- Fill required fields with realistic Norwegian data.');
  console.log(
    "- If validation errors remain after submit, click the label/fieldset inside error blocks to trigger validation.",
  );
  console.log(
    `- Save often: playwright-cli snapshot --filename "${path.join(outputDir, "step.yml")}"`,
  );
  console.log(`- Or use: /save step`);
  console.log(
    `- Screenshot before submit: playwright-cli screenshot --filename "${path.join(outputDir, "before_submit.png")}" --full-page`,
  );
  console.log("- Submit only when validation errors are cleared.");
  console.log(
    '- If you see the modal "Det skjedde en feil under innsending av skjema. Prøv igjen senere." on save or submit, open DevTools -> Network before retrying. Then try resubmitting once. If it persists, record the Correlation ID header in test_results.txt.',
  );
  console.log(`- Open Dokumenter: playwright-cli goto "${dokumenterUrl}"`);
  console.log("- Select the same person if prompted.");
  console.log("- Wait for the Dokumenter list to load; the first item is the latest.");
  console.log("- Document name should match the form page h1#sidetittel.");
  console.log(
    `- Save Dokumenter list: playwright-cli snapshot --filename "${path.join(outputDir, "dokumenter.yml")}"`,
  );
  console.log("- Click the first document link to open it.");
  console.log("- Wait for the document HTML to render fully.");
  console.log(
    `- Save full-page document screenshot: playwright-cli screenshot --filename "${path.join(outputDir, "document_screenshot.png")}" --full-page`,
  );
  console.log(
    `- Save document snapshot: playwright-cli snapshot --filename "${path.join(outputDir, "document.yml")}"`,
  );
  console.log(
    `- Save HTML: playwright-cli eval "document.documentElement.outerHTML" > "${path.join(outputDir, "document.html")}"`,
  );
  console.log(
    `- Record results: write test_results.txt in "${outputDir}" with status and notes.`,
  );
  console.log("- Close browser when done: playwright-cli close");
  console.log("");
}

function normalizeLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function extractPersonsFromSnapshotText(text) {
  const lines = text.split(/\r?\n/);
  const header = 'region "Hvem vil du bruke Helsenorge på vegne av?"';
  let regionIndent = null;
  let inRegion = false;
  const names = [];
  const buttons = [];
  for (const line of lines) {
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    if (!inRegion) {
      if (line.includes(header)) {
        inRegion = true;
        regionIndent = indent;
      }
      continue;
    }
    if (indent <= regionIndent && line.trim().startsWith("-")) {
      break;
    }
    const strongMatch = line.match(/- strong .*?:\s*(.+)$/);
    if (strongMatch) {
      names.push(strongMatch[1].trim());
      continue;
    }
    const buttonMatch = line.match(/- button "([^"]+)"/);
    if (buttonMatch) {
      buttons.push(buttonMatch[1].trim());
    }
  }
  if (names.length) return sanitizePersonOptions(names);
  return sanitizePersonOptions(buttons);
}

function extractPersonsFromSnapshotFile(snapshotPath) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) return [];
  const text = fs.readFileSync(snapshotPath, "utf8");
  return extractPersonsFromSnapshotText(text);
}

async function fetchPersonOptions() {
  const script = [
    "() => {",
    'const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();',
    "const isVisible = (el) => {",
    "if (!el) return false;",
    "const style = window.getComputedStyle(el);",
    'if (!style || style.display === "none" || style.visibility === "hidden") {',
    "return false;",
    "}",
    "const rect = el.getBoundingClientRect();",
    "return rect.width >= 4 && rect.height >= 4;",
    "};",
    'const textOf = (el) => normalize(el.innerText || el.textContent || "");',
    'const itemSelectors = ["[role=\\"option\\"]","[role=\\"listitem\\"]","li","button","a","div","span"];',
    "const containerSelectors = [",
    '"[role=\\"listbox\\"]",',
    '"[role=\\"list\\"]",',
    '"ul",',
    '"ol",',
    '"[data-testid*=\\"person\\" i]",',
    '"[data-testid*=\\"people\\" i]",',
    '"[aria-label*=\\"person\\" i]",',
    '"[aria-label*=\\"personer\\" i]"',
    "];",
    "const containers = containerSelectors",
    ".flatMap((sel) => Array.from(document.querySelectorAll(sel)))",
    ".filter(isVisible);",
    "const lists = containers",
    ".map((container) => {",
    "const items = Array.from(container.querySelectorAll(itemSelectors.join(\",\")))",
    ".filter(isVisible)",
    ".map(textOf)",
    ".filter(Boolean)",
    ".filter((text) => text.length <= 60);",
    "return Array.from(new Set(items));",
    "})",
    ".filter((list) => list.length >= 2 && list.length <= 30);",
    "if (lists.length) { return lists.sort((a, b) => b.length - a.length)[0]; }",
    "const labeled = Array.from(document.querySelectorAll(",
    "\"[data-testid*=\\\\\"person\\\\\" i],",
    "[data-testid*=\\\\\"personer\\\\\" i],",
    "[aria-label*=\\\\\"person\\\\\" i],",
    "[aria-label*=\\\\\"personer\\\\\" i]\"",
    "))",
    ".map(textOf)",
    ".filter(Boolean)",
    ".filter((text) => text.length <= 60);",
    "if (labeled.length) { return Array.from(new Set(labeled)); }",
    "const scope = document.querySelector(\"main\") || document.body;",
    "const fallback = Array.from(scope.querySelectorAll(",
    "\"button,[role=\\\\\"button\\\\\"],a,[role=\\\\\"link\\\\\"],li,[role=\\\\\"listitem\\\\\"],",
    "[role=\\\\\"option\\\\\"]\"",
    "))",
    ".filter(isVisible)",
    ".map(textOf)",
    ".filter(Boolean)",
    ".filter((text) => text.length <= 60);",
    "return Array.from(new Set(fallback));",
    "}",
  ].join(" ");

  const result = await runPlaywrightCliCapture(["eval", script]);
  const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();
  if (result.code !== 0 || combinedOutput.startsWith("### Error")) {
    console.log(
      `Failed to read person list from browser (${combinedOutput || "unknown error"}).`,
    );
    return [];
  }
  return parsePersonList(result.stdout);
}

async function promptPersonSelection(config) {
  const answer = await ask(
    "Open the person picker, then press Enter to scan (or type skip): ",
  );
  if (/^skip$/i.test(answer)) return;
  let options = extractPersonsFromSnapshotFile(
    config.lastRunDir
      ? path.join(config.lastRunDir, "page_open.yml")
      : "",
  );
  if (!options.length) {
    options = [];
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await sleep(1500);
    }
    if (!options.length) {
      options = await fetchPersonOptions();
    }
    if (options.length) break;
  }
  options = prioritizeRecommended(options, RECOMMENDED_PERSON);
  if (!options.length) {
    console.log(
      "No person options detected. Open the picker and run /people to retry.",
    );
    return;
  }
  console.log("Select a person:");
  options.forEach((option, index) => {
    const recommended =
      option.toLowerCase() === RECOMMENDED_PERSON.toLowerCase()
        ? " (Recommended)"
        : "";
    console.log(`${index + 1}: ${option}${recommended}`);
  });
  while (true) {
    const selection = await ask(`Select person by number (1-${options.length}): `);
    const idx = Number.parseInt(selection, 10);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= options.length) {
      const chosen = options[idx - 1];
      console.log(`Select this person in the UI: ${chosen}`);
      config.lastPerson = chosen;
      saveConfig(config);
      return;
    }
    console.log("Invalid selection. Try again or type /clear then /people.");
  }
}

async function saveArtifacts(config, label) {
  if (!config.lastRunDir) {
    console.log("No output folder yet. Run /test first.");
    return;
  }
  const safeLabel = sanitizeSegment(label || "save");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(config.lastRunDir, `${safeLabel}_${timestamp}`);
  await runPlaywrightCli(["snapshot", "--filename", `${base}.yml`]);
  await runPlaywrightCli(["screenshot", "--filename", `${base}.png`, "--full-page"]);
  console.log(`Saved: ${base}.yml and ${base}.png (full-page)`);
}

async function handleSetup() {
  if (!isPlaywrightCliAvailable()) {
    const answer = await ask(
      "Playwright CLI is not installed. Install globally now? (y/n): ",
    );
    if (!/^y(es)?$/i.test(answer)) {
      console.log("Skipped installation.");
      return;
    }
    const installCode = await runCommand("npm", [
      "install",
      "-g",
      "@playwright/cli@latest",
    ]);
    if (installCode !== 0) {
      console.log("Install failed. Fix npm and re-run /setup.");
      return;
    }
  }

  const skillsCode = await runPlaywrightCli(["install", "--skills"]);
  if (skillsCode === 0) {
    console.log("Playwright CLI skills installed.");
  } else {
    console.log("Failed to install Playwright CLI skills.");
  }
}

async function handleUpdate(config) {
  const repoRoot = findRepoRoot(__dirname);
  if (repoRoot) {
    console.log(`Updating repository in ${repoRoot}...`);
    const gitCode = await runCommand("git", [
      "-C",
      repoRoot,
      "pull",
      "--ff-only",
    ]);
    if (gitCode !== 0) {
      console.log("Git update failed. Fix git and re-run /update.");
      return;
    }
  } else {
    console.log("No git repo found. Skipping code update.");
  }

  const updateAnswer = await ask(
    "Update Playwright CLI globally now? (y/n): ",
  );
  if (/^y(es)?$/i.test(updateAnswer)) {
    const installCode = await runCommand("npm", [
      "install",
      "-g",
      "@playwright/cli@latest",
    ]);
    if (installCode !== 0) {
      console.log("Playwright CLI update failed. Fix npm and re-run /update.");
      return;
    }
  } else {
    console.log("Skipped Playwright CLI update.");
  }

  const skillsCode = await runPlaywrightCli(["install", "--skills"]);
  if (skillsCode === 0) {
    console.log("Playwright CLI skills installed.");
    config.lastSeenVersion = LOCAL_VERSION;
    saveConfig(config);
  } else {
    console.log("Failed to install Playwright CLI skills.");
    return;
  }

  console.log(
    "Reload the skill in Copilot CLI with /skills (reload) or /restart.",
  );
}

async function handleVersionMismatch(config) {
  if (!config.lastSeenVersion) {
    config.lastSeenVersion = LOCAL_VERSION;
    saveConfig(config);
    return;
  }
  if (config.lastSeenVersion === LOCAL_VERSION) return;
  console.log(
    `Version change detected: saved ${config.lastSeenVersion} -> local ${LOCAL_VERSION}.`,
  );
  const answer = await ask("Run /update now? (y/n): ");
  if (/^y(es)?$/i.test(answer)) {
    await handleUpdate(config);
  } else {
    console.log("You can run /update later to refresh dependencies.");
  }
}

async function handleTest(url, config) {
  const updated = await ensurePnrInUrl(url, config, ask);
  if (!updated.pnr) {
    console.log("PNR is required when not included in the URL.");
    return;
  }

  const personaChoice = await promptPersona(config);
  const scenarioChoice = await promptScenario();

  const formId = sanitizeSegment(extractFormId(updated.url));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(OUTPUT_BASE, formId, timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  config.lastTestUrl = updated.url;
  config.lastRunDir = outputDir;
  saveConfig(config);

  // Start recording
  startRecording(outputDir);

  if (personaChoice.type === "preset") {
    fs.writeFileSync(
      path.join(outputDir, "persona.json"),
      JSON.stringify(personaChoice.persona, null, 2),
    );
  } else if (personaChoice.type === "custom") {
    fs.writeFileSync(
      path.join(outputDir, "persona.json"),
      JSON.stringify(
        { id: "custom", name: "Egendefinert", description: personaChoice.description, traits: {} },
        null,
        2,
      ),
    );
  } else {
    fs.writeFileSync(
      path.join(outputDir, "persona.json"),
      JSON.stringify(
        { id: "noen", name: "Noen", description: "Nøytrale svar", traits: {} },
        null,
        2,
      ),
    );
  }

  fs.writeFileSync(
    path.join(outputDir, "scenario.json"),
    JSON.stringify(scenarioChoice, null, 2),
  );

  console.log("Opening form with Playwright CLI...");
  await runPlaywrightCli(["open", updated.url]);
  await runPlaywrightCli([
    "snapshot",
    "--filename",
    path.join(outputDir, "page_open.yml"),
  ]);
  await runPlaywrightCli([
    "screenshot",
    "--filename",
    path.join(outputDir, "page_open.png"),
    "--full-page",
  ]);

  await promptPersonSelection(config);

  const dokumenterUrl = resolveDokumenterUrl(config);
  console.log(`Output folder: ${outputDir}`);
  if (dokumenterUrl) {
    console.log(`Dokumenter URL: ${dokumenterUrl}`);
  }
  printNextSteps(
    outputDir,
    dokumenterUrl ||
      "/dokumenter?pnr={PNR}",
  );

  // Save recording
  const recordingPath = saveRecording();
  if (recordingPath) {
    console.log(`Recording saved: ${recordingPath}`);
    console.log(`Replay with: form-tester replay "${recordingPath}"`);
  }
}

async function handleTestAuto(url, config, flags) {
  const v = flags.verbosity || "normal";
  const log = (msg) => { if (v !== "silent") console.log(msg); };
  const verbose = (msg) => { if (v === "verbose") console.log(msg); };

  // Resolve PNR — check URL first, then flag, then config
  const pnr = extractPnrFromUrl(url) || flags.pnr || config.pnr;
  if (!pnr) {
    console.error("No PNR available. Pass --pnr <value>, include pnr= in the URL, or set it in form-tester.config.json");
    process.exit(1);
  }
  const fullUrl = extractPnrFromUrl(url) ? url : setPnrOnUrl(url, pnr);
  config.pnr = pnr;
  saveConfig(config);
  verbose(`URL: ${fullUrl}`);

  // Resolve persona
  let personaChoice;
  const personaId = flags.persona;
  if (personaId) {
    const found = getPersonaById(personaId);
    if (found) {
      log(`Persona: ${found.name} — ${found.description}`);
      personaChoice = { type: "preset", persona: found };
    } else {
      log(`Unknown persona "${personaId}", using Noen.`);
      personaChoice = { type: "noen", persona: null };
    }
  } else {
    log("Persona: Noen — nøytrale svar (auto)");
    personaChoice = { type: "noen", persona: null };
  }

  // Resolve scenario
  const scenarioChoice = flags.scenario
    ? { type: "custom", description: flags.scenario }
    : { type: "default", description: "Standard test" };
  log(`Scenario: ${scenarioChoice.description}`);

  // Create output directory
  const formId = sanitizeSegment(extractFormId(fullUrl));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(OUTPUT_BASE, formId, timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  config.lastTestUrl = fullUrl;
  config.lastRunDir = outputDir;
  saveConfig(config);

  // Start recording
  startRecording(outputDir);

  // Save persona and scenario
  if (personaChoice.type === "preset") {
    fs.writeFileSync(path.join(outputDir, "persona.json"), JSON.stringify(personaChoice.persona, null, 2));
  } else {
    fs.writeFileSync(path.join(outputDir, "persona.json"), JSON.stringify(
      { id: "noen", name: "Noen", description: "Nøytrale svar", traits: {} }, null, 2,
    ));
  }
  fs.writeFileSync(path.join(outputDir, "scenario.json"), JSON.stringify(scenarioChoice, null, 2));

  // Open and take initial full-page screenshot
  log("Opening form with Playwright CLI...");
  await runPlaywrightCli(["open", fullUrl]);
  await runPlaywrightCli(["snapshot", "--filename", path.join(outputDir, "page_open.yml")]);
  await runPlaywrightCli(["screenshot", "--filename", path.join(outputDir, "page_open.png"), "--full-page"]);
  log("Saved: page_open.yml + page_open.png (full-page)");

  // Auto-select person (try recommended, then first available)
  let options = extractPersonsFromSnapshotFile(path.join(outputDir, "page_open.yml"));
  if (!options.length) {
    for (let attempt = 0; attempt < 3; attempt++) {
      verbose(`Scanning for person options (attempt ${attempt + 1})...`);
      await sleep(1500);
      options = await fetchPersonOptions();
      if (options.length) break;
    }
  }
  if (options.length) {
    options = prioritizeRecommended(options, RECOMMENDED_PERSON);
    const chosen = options[0];
    log(`Auto-selected person: ${chosen}`);
    config.lastPerson = chosen;
    saveConfig(config);
  }

  // Take form loaded screenshot after person selection
  await runPlaywrightCli(["snapshot", "--filename", path.join(outputDir, "form_loaded.yml")]);
  await runPlaywrightCli(["screenshot", "--filename", path.join(outputDir, "form_loaded.png"), "--full-page"]);
  log("Saved: form_loaded.yml + form_loaded.png (full-page)");

  const dokumenterUrl = resolveDokumenterUrl(config);

  // Always print output folder (even in silent mode)
  console.log(`Output folder: ${outputDir}`);

  if (v !== "silent") {
    if (dokumenterUrl) {
      console.log(`Dokumenter URL: ${dokumenterUrl}`);
    }
    console.log("");
    console.log("IMPORTANT: All screenshots MUST use --full-page to capture the entire page.");
    console.log("Example: playwright-cli screenshot --filename \"path/to/file.png\" --full-page");
    console.log("");
    printNextSteps(outputDir, dokumenterUrl || "/dokumenter?pnr={PNR}");
  }

  // Save recording
  const recordingPath = saveRecording();
  if (recordingPath) {
    log(`Recording saved: ${recordingPath}`);
    log(`Replay with: form-tester replay "${recordingPath}"`);
  }
}

async function handleReplay(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Recording not found: ${filePath}`);
    process.exit(1);
  }
  const recording = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`Replaying ${recording.commandCount} commands from ${recording.startedAt}`);
  console.log("");

  for (let i = 0; i < recording.commands.length; i++) {
    const cmd = recording.commands[i];
    console.log(`[${i + 1}/${recording.commandCount}] playwright-cli ${cmd.args.join(" ")}`);
    const code = await runPlaywrightCli(cmd.args);
    if (code !== 0) {
      console.error(`Command failed with exit code ${code}. Stopping replay.`);
      process.exit(1);
    }
  }

  console.log("\nReplay complete.");
}

async function handleCommand(line, config) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let input = trimmed;
  if (!input.startsWith("/")) {
    input = `/test ${input}`;
  }

  const [command, ...rest] = input.split(" ");
  const arg = rest.join(" ").trim();

  switch (command) {
    case "/help":
      printHelp();
      break;
    case "/setup":
      await handleSetup();
      break;
    case "/update":
      await handleUpdate(config);
      break;
    case "/version":
      printVersion(config);
      break;
    case "/people":
      await promptPersonSelection(config);
      break;
    case "/persona":
      console.log("\nTilgjengelige personas:");
      console.log(formatPersonaList());
      break;
    case "/save": {
      const label = arg || (await ask("Label: "));
      await saveArtifacts(config, label);
      break;
    }
    case "/clear":
    case "/cls":
      clearConsole();
      break;
    case "/test": {
      const url = arg || (await ask("Form URL: "));
      if (!url) {
        console.log("Form URL is required.");
        break;
      }
      await handleTest(url, config);
      break;
    }
    case "/exit":
    case "/quit":
      ensureReadline().close();
      break;
    default:
      console.log("Unknown command. Use /help.");
  }
}

function copyDirSync(src, dest) {
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

function install(targetDir, isGlobal) {
  const pkgDir = __dirname;
  const skillsSrc = path.join(pkgDir, ".claude", "skills");
  const copilotSrc = path.join(pkgDir, ".github", "copilot-instructions.md");
  const configSrc = path.join(pkgDir, "form-tester.config.example.json");

  // Copy Claude Code skills
  const skillsDest = isGlobal
    ? path.join(targetDir, "skills")
    : path.join(targetDir, ".claude", "skills");
  for (const skill of ["form-tester", "playwright-cli"]) {
    const src = path.join(skillsSrc, skill);
    if (fs.existsSync(src)) {
      const dest = path.join(skillsDest, skill);
      copyDirSync(src, dest);
      console.log(`  Installed ${isGlobal ? "~/.claude" : ".claude"}/skills/${skill}/`);
    }
  }

  // Project-only files (skip for global install)
  if (!isGlobal) {
    if (fs.existsSync(copilotSrc)) {
      const copilotDest = path.join(targetDir, ".github", "copilot-instructions.md");
      fs.mkdirSync(path.dirname(copilotDest), { recursive: true });
      fs.copyFileSync(copilotSrc, copilotDest);
      console.log("  Installed .github/copilot-instructions.md");
    }

    if (fs.existsSync(configSrc)) {
      const configDest = path.join(targetDir, "form-tester.config.example.json");
      fs.copyFileSync(configSrc, configDest);
      console.log("  Installed form-tester.config.example.json");
    }
  }

  // Install playwright-cli globally if not already available
  if (isPlaywrightCliAvailable()) {
    console.log("  playwright-cli already in PATH");
  } else {
    console.log("  Installing playwright-cli globally...");
    try {
      execSync("npm install -g @playwright/cli@latest", {
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log("  Installed playwright-cli globally");
    } catch (err) {
      console.log(
        "  WARNING: Failed to install playwright-cli globally.",
      );
      console.log(
        "  Run manually: npm install -g @playwright/cli@latest",
      );
    }
  }

  console.log("\nDone! Next steps:");
  console.log("  1. cp form-tester.config.example.json form-tester.config.json");
  console.log('  2. Edit form-tester.config.json and set your "pnr"');
  console.log("  3. Run: form-tester");
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "install") {
    const isGlobal = args.includes("--global") || args.includes("-g");
    const remaining = args.slice(1).filter((a) => a !== "--global" && a !== "-g");
    let targetDir;
    if (isGlobal) {
      const home = process.env.HOME || process.env.USERPROFILE;
      targetDir = path.join(home, ".claude");
      // Global installs skills directly into ~/.claude/skills/
      console.log(`Installing form-tester skills globally to ${targetDir} ...\n`);
    } else {
      targetDir = remaining[0] ? path.resolve(remaining[0]) : process.cwd();
      console.log(`Installing form-tester skills to ${targetDir} ...\n`);
    }
    install(targetDir, isGlobal);
    process.exit(0);
  }

  if (args[0] === "replay") {
    const filePath = args[1];
    if (!filePath) {
      console.error("Usage: form-tester replay <recording.json>");
      process.exit(1);
    }
    await handleReplay(path.resolve(filePath));
    process.exit(0);
  }

  if (args[0] === "test" && args.includes("--auto")) {
    const config = loadConfig();
    const url = args.find((a) => a.startsWith("http"));
    if (!url) {
      console.error("Usage: form-tester test <url> --auto [--pnr <pnr>] [--persona <id>] [--scenario <text>] [--silent|--verbose]");
      process.exit(1);
    }
    const flagVal = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const verbosity = args.includes("--silent") ? "silent" : args.includes("--verbose") ? "verbose" : "normal";
    await handleTestAuto(url, config, {
      pnr: flagVal("--pnr"),
      persona: flagVal("--persona"),
      scenario: flagVal("--scenario"),
      verbosity,
    });
    process.exit(0);
  }

  const config = loadConfig();
  await handleVersionMismatch(config);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  console.log("Form tester CLI (Playwright CLI wrapper)");
  console.log("Type /help for commands.");
  const currentRl = ensureReadline();
  currentRl.prompt();

  currentRl.on("line", async (line) => {
    try {
      await handleCommand(line, config);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    currentRl.prompt();
  });

  currentRl.on("close", () => {
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  extractFormId,
  extractPnrFromUrl,
  setPnrOnUrl,
  ensurePnrInUrl,
  sanitizeSegment,
  resolveDokumenterUrl,
  prioritizeRecommended,
  parsePersonList,
  getPersonas,
  getPersonaById,
  formatPersonaList,
  promptScenario,
};

