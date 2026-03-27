const fs = require("fs");
const path = require("path");

const { OUTPUT_BASE, RECOMMENDED_PERSON, saveConfig } = require("./config");
const {
  ask,
  sleep,
  sanitizeSegment,
  prioritizeRecommended,
} = require("./utils");
const { startRecording } = require("./recording");
const { logIssue } = require("./issues");
const { PERSONAS, getPersonaById, formatPersonaList } = require("./personas");
const {
  resolveDokumenterUrl,
  extractPnrFromUrl,
  setPnrOnUrl,
  ensurePnrInUrl,
  extractFormId,
} = require("./url");
const { runPlaywrightCli } = require("./playwright");
const { extractPersonsFromSnapshotFile } = require("./snapshot");
const { fetchPersonOptions } = require("./handlers");

async function promptScenario() {
  console.log(
    "\nTestscenario (beskriv hva du vil teste, eller trykk Enter for standard test):",
  );
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
  const answer = await ask(`Velg (1-${PERSONAS.length + 2}): `);
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

async function promptPersonSelection(config) {
  const answer = await ask(
    "Open the person picker, then press Enter to scan (or type skip): ",
  );
  if (/^skip$/i.test(answer)) return;
  let options = extractPersonsFromSnapshotFile(
    config.lastRunDir ? path.join(config.lastRunDir, "page_open.yml") : "",
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
    logIssue("person-selection", "No person options detected after 3 attempts");
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
    const selection = await ask(
      `Select person by number (1-${options.length}): `,
    );
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
  await runPlaywrightCli([
    "screenshot",
    "--filename",
    `${base}.png`,
    "--full-page",
  ]);
  console.log(`Saved: ${base}.yml and ${base}.png (full-page)`);
}

function printNextSteps(outputDir, dokumenterUrl) {
  console.log("");
  console.log("Next steps (manual Playwright CLI):");
  console.log("- Accept cookies if prompted.");
  console.log(
    "- Use the person selection prompt to choose the correct person.",
  );
  console.log("- Fill required fields with realistic Norwegian data.");
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
  console.log(
    "- Wait for the Dokumenter list to load; the first item is the latest.",
  );
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
  try {
    config.baseUrl = new URL(updated.url).origin;
  } catch (e) {}
  saveConfig(config);

  const recordingFile = startRecording(outputDir);
  config.activeRecording = recordingFile;
  saveConfig(config);

  if (personaChoice.type === "preset") {
    fs.writeFileSync(
      path.join(outputDir, "persona.json"),
      JSON.stringify(personaChoice.persona, null, 2),
    );
  } else if (personaChoice.type === "custom") {
    fs.writeFileSync(
      path.join(outputDir, "persona.json"),
      JSON.stringify(
        {
          id: "custom",
          name: "Egendefinert",
          description: personaChoice.description,
          traits: {},
        },
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
  printNextSteps(outputDir, dokumenterUrl || "/dokumenter?pnr={PNR}");

  console.log(`Recording active: ${config.activeRecording}`);
  console.log(
    `Use 'form-tester exec' for all playwright-cli commands to record them.`,
  );
  console.log(`Recording finalizes on 'form-tester exec close'.`);
}

async function handleTestAuto(url, config, flags) {
  const v = flags.verbosity || "normal";
  const log = (msg) => {
    if (v !== "silent") console.log(msg);
  };
  const verbose = (msg) => {
    if (v === "verbose") console.log(msg);
  };

  const pnr = extractPnrFromUrl(url) || flags.pnr || config.pnr;
  if (!pnr) {
    console.error(
      "No PNR available. Pass --pnr <value>, include pnr= in the URL, or set it in form-tester.config.json",
    );
    process.exit(1);
  }
  const fullUrl = extractPnrFromUrl(url) ? url : setPnrOnUrl(url, pnr);
  config.pnr = pnr;
  saveConfig(config);
  verbose(`URL: ${fullUrl}`);

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

  const scenarioChoice = flags.scenario
    ? { type: "custom", description: flags.scenario }
    : { type: "default", description: "Standard test" };
  log(`Scenario: ${scenarioChoice.description}`);

  const formId = sanitizeSegment(extractFormId(fullUrl));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(OUTPUT_BASE, formId, timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  config.lastTestUrl = fullUrl;
  config.lastRunDir = outputDir;
  try {
    config.baseUrl = new URL(fullUrl).origin;
  } catch (e) {}
  saveConfig(config);

  const recordingFile = startRecording(outputDir);
  config.activeRecording = recordingFile;
  saveConfig(config);

  if (personaChoice.type === "preset") {
    fs.writeFileSync(
      path.join(outputDir, "persona.json"),
      JSON.stringify(personaChoice.persona, null, 2),
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

  log("Opening form with Playwright CLI...");
  await runPlaywrightCli(["open", fullUrl]);
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
  log("Saved: page_open.yml + page_open.png (full-page)");

  let options = extractPersonsFromSnapshotFile(
    path.join(outputDir, "page_open.yml"),
  );
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

  await runPlaywrightCli([
    "snapshot",
    "--filename",
    path.join(outputDir, "form_loaded.yml"),
  ]);
  await runPlaywrightCli([
    "screenshot",
    "--filename",
    path.join(outputDir, "form_loaded.png"),
    "--full-page",
  ]);
  log("Saved: form_loaded.yml + form_loaded.png (full-page)");

  const dokumenterUrl = resolveDokumenterUrl(config);

  console.log(`Output folder: ${outputDir}`);

  if (v !== "silent") {
    if (dokumenterUrl) {
      console.log(`Dokumenter URL: ${dokumenterUrl}`);
    }
    console.log("");
    console.log(
      "IMPORTANT: All screenshots MUST use --full-page to capture the entire page.",
    );
    console.log(
      'Example: playwright-cli screenshot --filename "path/to/file.png" --full-page',
    );
    console.log("");
    printNextSteps(outputDir, dokumenterUrl || "/dokumenter?pnr={PNR}");
  }

  log(`Recording active: ${config.activeRecording}`);
  log(`Use 'form-tester exec' for all playwright-cli commands to record them.`);
  log(`Recording finalizes on 'form-tester exec close'.`);
}

module.exports = {
  promptScenario,
  promptPersona,
  promptPersonSelection,
  saveArtifacts,
  printNextSteps,
  handleTest,
  handleTestAuto,
};
