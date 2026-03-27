const fs = require("fs");
const path = require("path");
const { CONFIG_PATH, LOCAL_VERSION } = require("./config");

let activeRecordingPath = null;

function startRecording(outputDir) {
  const filePath = path.join(outputDir, "recording.json");
  const data = {
    version: LOCAL_VERSION,
    startedAt: new Date().toISOString(),
    completedAt: null,
    commandCount: 0,
    commands: [],
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  activeRecordingPath = filePath;
  return filePath;
}

function recordCommand(args) {
  // In-process recording
  if (activeRecordingPath && fs.existsSync(activeRecordingPath)) {
    appendToRecording(activeRecordingPath, args);
    return;
  }
  // Check config for active recording (cross-process via exec)
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (config.activeRecording && fs.existsSync(config.activeRecording)) {
      appendToRecording(config.activeRecording, args);
    }
  } catch (e) {
    // no config or no active recording, skip
  }
}

function appendToRecording(filePath, args) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.commands.push({ args, timestamp: new Date().toISOString() });
    data.commandCount = data.commands.length;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    // recording file corrupted or gone, skip
  }
}

function finalizeRecording(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.completedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  } catch (e) {
    return null;
  }
}

function saveRecording() {
  const result = finalizeRecording(activeRecordingPath);
  activeRecordingPath = null;
  // Clear active recording from config
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    delete config.activeRecording;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    // config not found, skip
  }
  return result;
}

module.exports = {
  startRecording,
  recordCommand,
  appendToRecording,
  finalizeRecording,
  saveRecording,
};
