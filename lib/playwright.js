const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { recordCommand } = require("./recording");

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

function getPlaywrightCommandSpec() {
  const command = getPlaywrightCommand();
  const lower = command.toLowerCase();
  if (
    process.platform === "win32" &&
    (lower.endsWith(".cmd") || lower.endsWith(".ps1"))
  ) {
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
    return { command, args: [], shell: true };
  }
  return { command, args: [], shell: false };
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
    const child = spawn(spec.command, [...spec.args, ...args], captureOpts);
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

module.exports = {
  getPlaywrightCommand,
  isPlaywrightCliAvailable,
  runCommand,
  getPlaywrightCommandSpec,
  runPlaywrightCli,
  runPlaywrightCliCapture,
};
