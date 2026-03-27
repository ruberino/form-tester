#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// --- lib imports ---
const {
  CONFIG_PATH,
  LOCAL_VERSION,
  loadConfig,
  saveConfig,
} = require("./lib/config");
const {
  ensureReadline,
  ask,
  sanitizeSegment,
  clearConsole,
} = require("./lib/utils");
const { recordCommand, finalizeRecording } = require("./lib/recording");
const {
  ISSUE_CATEGORIES,
  logIssue,
  listIssues,
  formatIssue,
} = require("./lib/issues");
const { formatPersonaList, getPersonaById } = require("./lib/personas");
const {
  resolveDokumenterUrl,
  resolveFormUrl,
  extractPnrFromUrl,
  setPnrOnUrl,
  extractFormId,
} = require("./lib/url");
const { getPlaywrightCommandSpec } = require("./lib/playwright");
const { handleGenerate, handleRun, handleReplay } = require("./lib/generate");
const {
  handleCookies,
  handleSelectPerson,
  handleDocuments,
  handleValidate,
} = require("./lib/handlers");
const {
  handleTest,
  handleTestAuto,
  promptPersonSelection,
  saveArtifacts,
  printNextSteps,
} = require("./lib/test");
const {
  handleSetup,
  handleUpdate,
  handleVersionMismatch,
  printHelp,
  printVersion,
  install,
} = require("./lib/setup");

// --- Interactive command handler ---

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
    case "/recording": {
      const rec = config.activeRecording;
      if (rec && fs.existsSync(rec)) {
        const data = JSON.parse(fs.readFileSync(rec, "utf8"));
        console.log(`Active recording: ${rec}`);
        console.log(`Commands recorded: ${data.commandCount}`);
        console.log(`Started: ${data.startedAt}`);
      } else {
        console.log(
          "No active recording. Start a test with /test to begin recording.",
        );
      }
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

// --- CLI entry point ---

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "init") {
    const config = loadConfig();
    console.log("Form Tester Setup\n");
    console.log("Current config:");
    console.log(`  baseUrl:       ${config.baseUrl || "(not set)"}`);
    console.log(`  pnr:           ${config.pnr || "(not set)"}`);
    console.log(`  person:        ${config.person || "(not set)"}`);
    console.log(`  skjemaUrl:     ${config.skjemaUrl || "/skjemautfyller"}`);
    console.log(
      `  dokumenterUrl: ${config.dokumenterUrlTemplate || "/dokumenter?pnr={PNR}"}`,
    );
    console.log("");

    const currentRl = ensureReadline();

    const prompt = (question, current) =>
      new Promise((resolve) => {
        const suffix = current ? ` [${current}]` : "";
        currentRl.question(`${question}${suffix}: `, (answer) => {
          resolve(answer.trim() || current || "");
        });
      });

    config.baseUrl = await prompt(
      "Base URL (e.g. https://tjenester-a-vak-sprak.int-hn.nhn.no)",
      config.baseUrl,
    );
    config.pnr = await prompt("PNR (fødselsnummer for test)", config.pnr);
    config.person = await prompt(
      "Default person name (e.g. Uromantisk Direktør)",
      config.person,
    );
    config.skjemaUrl = await prompt(
      "Skjema path prefix",
      config.skjemaUrl || "/skjemautfyller",
    );
    config.dokumenterUrlTemplate = await prompt(
      "Dokumenter URL template",
      config.dokumenterUrlTemplate || "/dokumenter?pnr={PNR}",
    );

    saveConfig(config);
    currentRl.close();

    console.log("\nConfig saved to form-tester.config.json:");
    console.log(`  baseUrl:       ${config.baseUrl}`);
    console.log(`  pnr:           ${config.pnr}`);
    console.log(`  person:        ${config.person}`);
    console.log(`  skjemaUrl:     ${config.skjemaUrl}`);
    console.log(`  dokumenterUrl: ${config.dokumenterUrlTemplate}`);

    const testUrl = resolveFormUrl("SLV-PasRapp-2020", config);
    const withPnr =
      config.pnr && !extractPnrFromUrl(testUrl)
        ? setPnrOnUrl(testUrl, config.pnr)
        : testUrl;
    console.log(`\nTest: form-tester test SLV-PasRapp-2020 --auto`);
    console.log(`  → ${withPnr}`);

    process.exit(0);
  }

  if (args[0] === "install") {
    const isGlobal = args.includes("--global") || args.includes("-g");
    const remaining = args
      .slice(1)
      .filter((a) => a !== "--global" && a !== "-g");
    let targetDir;
    if (isGlobal) {
      const home = process.env.HOME || process.env.USERPROFILE;
      targetDir = path.join(home, ".claude");
      console.log(
        `Installing form-tester skills globally to ${targetDir} ...\n`,
      );
    } else {
      targetDir = remaining[0] ? path.resolve(remaining[0]) : process.cwd();
      console.log(`Installing form-tester skills to ${targetDir} ...\n`);
    }
    install(targetDir, isGlobal);
    process.exit(0);
  }

  if (args[0] === "exec") {
    const pwArgs = args.slice(1);
    if (!pwArgs.length) {
      console.error(
        "Usage: form-tester exec <playwright-cli command and args>",
      );
      process.exit(1);
    }
    recordCommand(pwArgs);
    const spec = getPlaywrightCommandSpec();
    const spawnOpts = { stdio: "inherit" };
    if (spec.shell) spawnOpts.shell = true;
    const code = await new Promise((resolve) => {
      const child = spawn(spec.command, [...spec.args, ...pwArgs], spawnOpts);
      child.on("error", (err) => {
        console.error(err.message);
        resolve(1);
      });
      child.on("exit", (c) => resolve(c ?? 0));
    });
    if (pwArgs[0] === "close") {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
        if (config.activeRecording) {
          const rPath = finalizeRecording(config.activeRecording);
          delete config.activeRecording;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
          if (rPath) console.log(`Recording saved: ${rPath}`);
        }
      } catch (e) {
        // no config, skip
      }
    }
    process.exit(code);
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

  if (args[0] === "generate") {
    const config = loadConfig();
    const recordingPath = args[1] ? path.resolve(args[1]) : null;
    const outputDir = recordingPath
      ? path.dirname(recordingPath)
      : config.lastRunDir;
    const result = await handleGenerate(config, { recordingPath, outputDir });
    process.exit(result ? 0 : 1);
  }

  if (args[0] === "run") {
    const config = loadConfig();
    let testFile = args[1] ? path.resolve(args[1]) : null;
    if (!testFile) {
      const lastRunDir = config.lastRunDir;
      if (lastRunDir) {
        const generated = path.join(lastRunDir, "test.generated.js");
        if (fs.existsSync(generated)) {
          testFile = generated;
        }
      }
    }
    if (!testFile) {
      console.error(
        "Usage: form-tester run <test-file.js> [--trace] [--headless]",
      );
      process.exit(1);
    }
    const code = await handleRun(testFile, config, {
      trace: args.includes("--trace"),
      headless: args.includes("--headless"),
    });
    process.exit(code);
  }

  if (args[0] === "issue") {
    const category = args[1];
    const message = args.slice(2).join(" ");
    if (!category || !message) {
      console.error("Usage: form-tester issue <category> <message>");
      console.error(`\nCategories: ${ISSUE_CATEGORIES.join(", ")}`);
      process.exit(1);
    }
    if (!ISSUE_CATEGORIES.includes(category)) {
      console.error(
        `Unknown category "${category}". Valid: ${ISSUE_CATEGORIES.join(", ")}`,
      );
      process.exit(1);
    }
    const config = loadConfig();
    const entry = logIssue(category, message, {
      url: config.lastTestUrl || undefined,
      formId: config.lastTestUrl
        ? extractFormId(config.lastTestUrl)
        : undefined,
      outputDir: config.lastRunDir || undefined,
    });
    console.log(`Issue logged: [${entry.category}] ${entry.message}`);
    process.exit(0);
  }

  if (args[0] === "issues") {
    const limit = Number.parseInt(args[1], 10) || 20;
    const issues = listIssues(limit);
    if (!issues.length) {
      console.log("No issues logged yet.");
      process.exit(0);
    }
    console.log(`Last ${issues.length} issue(s):\n`);
    for (const issue of issues) {
      console.log(formatIssue(issue));
    }
    process.exit(0);
  }

  if (args[0] === "documents") {
    const config = loadConfig();
    const verbosity = args.includes("--silent")
      ? "silent"
      : args.includes("--verbose")
        ? "verbose"
        : "normal";
    const code = await handleDocuments(config, { verbosity });
    process.exit(code);
  }

  if (args[0] === "url") {
    const config = loadConfig();
    const input = args.slice(1).join(" ");
    if (!input) {
      console.error("Usage: form-tester url <form-name-or-path>");
      console.error("\nExamples:");
      console.error("  form-tester url SLV-PasRapp-2020");
      console.error("  form-tester url skjemautfyller/SLV-PasRapp-2020");
      console.error(
        "  form-tester url https://example.com/skjemautfyller/FORM",
      );
      console.error(
        `\nConfig: baseUrl=${config.baseUrl || "(not set)"}, skjemaUrl=${config.skjemaUrl || "/skjemautfyller"}, pnr=${config.pnr || "(not set)"}`,
      );
      console.error("\nRun 'form-tester init' to configure.");
      process.exit(1);
    }
    let formUrl = resolveFormUrl(input, config);
    if (config.pnr && !extractPnrFromUrl(formUrl)) {
      formUrl = setPnrOnUrl(formUrl, config.pnr);
    }
    const tmpConfig = { ...config, lastTestUrl: formUrl };
    const dokUrl = resolveDokumenterUrl(tmpConfig);

    console.log(`Form URL:       ${formUrl}`);
    console.log(`Dokumenter URL: ${dokUrl || "(not available — set pnr)"}`);
    console.log(`Person:         ${config.person || "(not set)"}`);
    console.log(`\nRun: form-tester test ${input} --auto`);
    process.exit(0);
  }

  if (args[0] === "cookies") {
    const code = await handleCookies();
    process.exit(code);
  }

  if (args[0] === "select-person") {
    const config = loadConfig();
    const targetName = args.slice(1).join(" ") || null;
    const code = await handleSelectPerson(config, targetName);
    process.exit(code);
  }

  if (args[0] === "validate") {
    const config = loadConfig();
    const code = await handleValidate(config);
    process.exit(code);
  }

  if (args[0] === "test" && args.includes("--human")) {
    const config = loadConfig();
    const flagVal = (flag) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const rawUrl = args.find(
      (a) =>
        a !== "test" &&
        !a.startsWith("--") &&
        a !== flagVal("--persona") &&
        a !== flagVal("--scenario") &&
        a !== flagVal("--pnr"),
    );
    const url = rawUrl ? resolveFormUrl(rawUrl, config) : null;
    if (!url) {
      console.error(
        'Usage: form-tester test <form-name-or-url> --human --persona <id> --scenario "<text>"',
      );
      process.exit(1);
    }
    const personaFlag = flagVal("--persona");
    const scenarioFlag = flagVal("--scenario");

    if (!personaFlag || scenarioFlag === undefined) {
      console.log(
        "HUMAN MODE: Ask the user to choose persona and scenario, then re-run with flags.\n",
      );
      console.log("Available personas:");
      console.log(formatPersonaList());
      console.log(
        "\nPersona IDs: ung-mann, gravid-kvinne, eldre-kvinne, kronisk-syk-mann, noen",
      );
      console.log(
        '\nRe-run with: form-tester test <url> --human --persona <id> --scenario "<description>"',
      );
      console.log('Use --scenario "" for standard test.');
      process.exit(0);
    }

    await handleTestAuto(url, config, {
      pnr: flagVal("--pnr"),
      persona: personaFlag,
      scenario: scenarioFlag || undefined,
      verbosity: "normal",
    });
    process.exit(0);
  }

  if (args[0] === "test" && args.includes("--auto")) {
    const config = loadConfig();
    const flagVal = (flag) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const rawUrl = args.find(
      (a) =>
        a !== "test" &&
        !a.startsWith("--") &&
        a !== flagVal("--persona") &&
        a !== flagVal("--scenario") &&
        a !== flagVal("--pnr"),
    );
    const url = rawUrl ? resolveFormUrl(rawUrl, config) : null;
    if (!url) {
      console.error(
        "Usage: form-tester test <form-name-or-url> --auto [--pnr <pnr>] [--persona <id>] [--scenario <text>] [--silent|--verbose]",
      );
      process.exit(1);
    }
    const verbosity = args.includes("--silent")
      ? "silent"
      : args.includes("--verbose")
        ? "verbose"
        : "normal";
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

// --- Re-exports for tests and external consumers ---
const { prioritizeRecommended, parsePersonList } = require("./lib/utils");
const { startRecording, appendToRecording } = require("./lib/recording");
const { getPersonas } = require("./lib/personas");
const { ensurePnrInUrl } = require("./lib/url");
const {
  parseSnapshotRefs,
  findGroupLabel,
  isNameUnique,
  refToLocator,
} = require("./lib/snapshot");
const { generateTestScript } = require("./lib/generate");
const { promptScenario } = require("./lib/test");

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
  startRecording,
  appendToRecording,
  finalizeRecording,
  logIssue,
  listIssues,
  resolveFormUrl,
  parseSnapshotRefs,
  findGroupLabel,
  isNameUnique,
  refToLocator,
  generateTestScript,
  ISSUE_CATEGORIES,
};
