const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const { LOCAL_VERSION, saveConfig } = require("./config");
const { ask, copyDirSync, findRepoRoot } = require("./utils");
const {
  isPlaywrightCliAvailable,
  runCommand,
  runPlaywrightCli,
} = require("./playwright");

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

  const updateAnswer = await ask("Update Playwright CLI globally now? (y/n): ");
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

function printHelp() {
  console.log(
    [
      "",
      "Subcommands (run directly):",
      "  form-tester init                         Set up config (baseUrl, pnr, person, etc.)",
      "  form-tester install [--global]          Install skill files into project or ~/.claude/skills/",
      "  form-tester test <name-or-url> --auto    Non-interactive test (for AI agents)",
      "  form-tester test <name-or-url> --human  Interactive test with prompts",
      "  form-tester url <name-or-path>           Resolve form name/path to full URL",
      "  form-tester exec <command> [args]       Run playwright-cli command (recorded)",
      "  form-tester replay <recording.json>     Replay a recorded test run (sequential CLI)",
      "  form-tester generate [recording.json]    Generate Playwright test from recording",
      "  form-tester run [test.js] [--trace]      Run generated test (fast, single process)",
      "  form-tester cookies                      Dismiss cookie banner",
      "  form-tester select-person [name]         Select person (recommended or by name)",
      "  form-tester validate                     Parse validation errors, scroll to each field",
      "  form-tester documents                    Verify document in Dokumenter (auto PDF/HTML)",
      "  form-tester issue <category> <message>   Log an issue for skill improvement",
      "  form-tester issues [limit]               Show recent logged issues",
      "",
      "Interactive commands:",
      "  /test {url}                 Open form URL and start test",
      "  /save {label}               Save snapshot + screenshot to output folder",
      "  /people                     Scan visible person list and prompt selection",
      "  /persona                    List available personas",
      "  /recording                  Show active recording status",
      "  /setup                      Install Playwright CLI + skills if missing",
      "  /update                     Update Playwright CLI and skills",
      "  /version                    Show version",
      "  /clear                      Clear the console",
      "  /help                       Show this help",
      "  /quit                       Exit",
    ].join("\n"),
  );
}

function printVersion(config) {
  const saved = config.lastSeenVersion || "unknown";
  console.log(`Local version: ${LOCAL_VERSION}`);
  console.log(`Saved version: ${saved}`);
}

function install(targetDir, isGlobal) {
  const pkgDir = path.resolve(__dirname, "..");
  const skillsSrc = path.join(pkgDir, ".claude", "skills");
  const copilotSrc = path.join(pkgDir, ".github", "copilot-instructions.md");
  const configSrc = path.join(pkgDir, "form-tester.config.example.json");

  const skillsDest = isGlobal
    ? path.join(targetDir, "skills")
    : path.join(targetDir, ".claude", "skills");
  for (const skill of ["form-tester", "playwright-cli"]) {
    const src = path.join(skillsSrc, skill);
    if (fs.existsSync(src)) {
      const dest = path.join(skillsDest, skill);
      copyDirSync(src, dest);
      console.log(
        `  Installed ${isGlobal ? "~/.claude" : ".claude"}/skills/${skill}/`,
      );
    }
  }

  if (!isGlobal) {
    if (fs.existsSync(copilotSrc)) {
      const copilotDest = path.join(
        targetDir,
        ".github",
        "copilot-instructions.md",
      );
      fs.mkdirSync(path.dirname(copilotDest), { recursive: true });
      fs.copyFileSync(copilotSrc, copilotDest);
      console.log("  Installed .github/copilot-instructions.md");
    }

    if (fs.existsSync(configSrc)) {
      const configDest = path.join(
        targetDir,
        "form-tester.config.example.json",
      );
      fs.copyFileSync(configSrc, configDest);
      console.log("  Installed form-tester.config.example.json");
    }
  }

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
      console.log("  WARNING: Failed to install playwright-cli globally.");
      console.log("  Run manually: npm install -g @playwright/cli@latest");
    }
  }

  console.log("\nDone! Next steps:");
  console.log(
    "  1. cp form-tester.config.example.json form-tester.config.json",
  );
  console.log('  2. Edit form-tester.config.json and set your "pnr"');
  console.log("  3. Run: form-tester");
}

module.exports = {
  handleSetup,
  handleUpdate,
  handleVersionMismatch,
  printHelp,
  printVersion,
  install,
};
