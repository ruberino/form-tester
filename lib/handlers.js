const fs = require("fs");
const path = require("path");

const { OUTPUT_BASE, RECOMMENDED_PERSON, saveConfig } = require("./config");
const { sleep, prioritizeRecommended, parsePersonList } = require("./utils");
const { logIssue } = require("./issues");
const { resolveDokumenterUrl } = require("./url");
const { runPlaywrightCli, runPlaywrightCliCapture } = require("./playwright");
const {
  findPersonRefInSnapshot,
  detectPage,
  parseValidationErrors,
  extractPersonsFromSnapshotFile,
} = require("./snapshot");

async function handleCookies() {
  const script = `() => {
    const selectors = [
      '[data-testid="reject-all-cookies"]',
      '[data-testid="accept-all-cookies"]',
      'button[id*="cookie" i]',
      'button[class*="cookie" i]',
      '[data-testid*="cookie" i]',
      'button:has-text("Avvis alle")',
      'button:has-text("Reject")',
      'button:has-text("Aksepter")',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        el.click();
        return { found: true, selector: sel, text: (el.textContent || "").trim().substring(0, 60) };
      }
    }
    return { found: false };
  }`;
  const result = await runPlaywrightCliCapture(["eval", script]);
  const output = result.stdout.replace(/^### Result\s*/i, "").trim();
  try {
    const parsed = JSON.parse(output);
    if (parsed.found) {
      console.log(
        `Cookie banner dismissed: "${parsed.text}" (${parsed.selector})`,
      );
      return 0;
    }
  } catch (e) {
    // parse failed, check raw output
  }
  console.log("No cookie banner found.");
  return 0;
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
    'const items = Array.from(container.querySelectorAll(itemSelectors.join(",")))',
    ".filter(isVisible)",
    ".map(textOf)",
    ".filter(Boolean)",
    ".filter((text) => text.length <= 60);",
    "return Array.from(new Set(items));",
    "})",
    ".filter((list) => list.length >= 2 && list.length <= 30);",
    "if (lists.length) { return lists.sort((a, b) => b.length - a.length)[0]; }",
    "const labeled = Array.from(document.querySelectorAll(",
    '"[data-testid*=\\\\"person\\\\" i],',
    '[data-testid*=\\\\"personer\\\\" i],',
    '[aria-label*=\\\\"person\\\\" i],',
    '[aria-label*=\\\\"personer\\\\" i]"',
    "))",
    ".map(textOf)",
    ".filter(Boolean)",
    ".filter((text) => text.length <= 60);",
    "if (labeled.length) { return Array.from(new Set(labeled)); }",
    'const scope = document.querySelector("main") || document.body;',
    "const fallback = Array.from(scope.querySelectorAll(",
    '"button,[role=\\\\"button\\\\"],a,[role=\\\\"link\\\\"],li,[role=\\\\"listitem\\\\"],',
    '[role=\\\\"option\\\\"]"',
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
    logIssue(
      "person-selection",
      `Failed to read person list: ${combinedOutput || "unknown error"}`,
    );
    return [];
  }
  return parsePersonList(result.stdout);
}

async function handleSelectPerson(config, targetName) {
  const log = (msg) => console.log(msg);

  if (!targetName && config.person) {
    targetName = config.person;
    log(`Using configured person: ${targetName}`);
  }

  const tmpSnapshot = path.join(
    config.lastRunDir || OUTPUT_BASE,
    `_person_scan_${Date.now()}.yml`,
  );
  await runPlaywrightCli(["snapshot", "--filename", tmpSnapshot]);

  let options = extractPersonsFromSnapshotFile(tmpSnapshot);

  if (!options.length) {
    for (let attempt = 0; attempt < 3; attempt++) {
      log(`Scanning for person options (attempt ${attempt + 1})...`);
      await sleep(1500);
      options = await fetchPersonOptions();
      if (options.length) break;
    }
  }

  if (!options.length) {
    console.error("No person options found on page.");
    logIssue(
      "person-selection",
      "No person options found by select-person command",
    );
    try {
      fs.unlinkSync(tmpSnapshot);
    } catch (e) {}
    return 1;
  }

  options = prioritizeRecommended(options, RECOMMENDED_PERSON);

  let chosen;
  if (targetName) {
    const target = targetName.toLowerCase();
    chosen = options.find((o) => o.toLowerCase().includes(target));
    if (!chosen) {
      log(`Person "${targetName}" not found. Available: ${options.join(", ")}`);
      chosen = options[0];
      log(`Falling back to: ${chosen}`);
    }
  } else {
    chosen = options[0];
  }

  log(`Selecting person: ${chosen}`);
  const clickScript = `() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], [role="option"], a'));
    const normalize = (s) => (s || "").replace(/\\s+/g, " ").trim();
    const target = ${JSON.stringify(chosen)};
    for (const btn of buttons) {
      const text = normalize(btn.textContent);
      if (text.includes(target) || text === target) {
        btn.click();
        return { clicked: true, text: text.substring(0, 80) };
      }
    }
    return { clicked: false, available: buttons.slice(0, 10).map(b => normalize(b.textContent).substring(0, 60)).filter(Boolean) };
  }`;
  const clickResult = await runPlaywrightCliCapture(["eval", clickScript]);
  const clickOutput = clickResult.stdout.replace(/^### Result\s*/i, "").trim();
  try {
    const parsed = JSON.parse(clickOutput);
    if (parsed.clicked) {
      log(`Person selected: ${parsed.text}`);
      config.lastPerson = chosen;
      saveConfig(config);
      await sleep(1000);
      if (config.lastRunDir) {
        await runPlaywrightCli([
          "screenshot",
          "--filename",
          path.join(config.lastRunDir, "person_selected.png"),
          "--full-page",
        ]);
      }
    } else {
      log("Could not click person button. Available buttons:");
      (parsed.available || []).forEach((b) => log(`  - ${b}`));
      logIssue(
        "person-selection",
        `Could not click "${chosen}". Buttons found but none matched.`,
      );
    }
  } catch (e) {
    log(`Person selection result: ${clickOutput}`);
  }

  try {
    fs.unlinkSync(tmpSnapshot);
  } catch (e) {}
  return 0;
}

async function handleDocuments(config, flags = {}) {
  const v = flags.verbosity || "normal";
  const log = (msg) => {
    if (v !== "silent") console.log(msg);
  };

  const outputDir = config.lastRunDir;
  if (!outputDir) {
    console.error("No output folder. Run a test first.");
    return 1;
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const personName = config.lastPerson || config.person || RECOMMENDED_PERSON;
  const maxSteps = 8;

  for (let step = 0; step < maxSteps; step++) {
    const snapPath = path.join(outputDir, `doc_step_${step}.yml`);
    await runPlaywrightCli(["snapshot", "--filename", snapPath]);
    const snapText = fs.existsSync(snapPath)
      ? fs.readFileSync(snapPath, "utf8")
      : "";
    const page = detectPage(snapText);
    log(`Step ${step + 1}: detected page = ${page}`);

    if (page === "cookies") {
      log("Dismissing cookies...");
      await handleCookies();
      await sleep(1000);
      continue;
    }

    if (page === "person-picker") {
      log("Selecting person...");
      const ref = findPersonRefInSnapshot(snapText, personName);
      if (ref) {
        await runPlaywrightCli(["click", ref]);
        log(`Clicked person button ref=${ref}`);
      } else {
        log("No person button found in snapshot.");
        logIssue(
          "person-selection",
          "No person button found in Dokumenter snapshot",
        );
      }
      await sleep(3000);
      continue;
    }

    if (page === "document-list") {
      fs.copyFileSync(snapPath, path.join(outputDir, "dokumenter.yml"));
      await runPlaywrightCli([
        "screenshot",
        "--filename",
        path.join(outputDir, "dokumenter.png"),
        "--full-page",
      ]);
      log("Saved: dokumenter.yml + dokumenter.png");

      const lines = snapText.split(/\r?\n/);
      let detailRef = null;
      for (const line of lines) {
        const match = line.match(/button "Se detaljer" \[ref=(e\d+)\]/);
        if (match) {
          detailRef = match[1];
          break;
        }
      }
      if (detailRef) {
        await runPlaywrightCli(["click", detailRef]);
        log(`Clicked 'Se detaljer' (ref=${detailRef})`);
      } else {
        log("Could not find 'Se detaljer' in snapshot.");
        logIssue("documents", "No 'Se detaljer' button found in document list");
      }
      await sleep(2000);
      continue;
    }

    if (page === "document-detail") {
      const lines = snapText.split(/\r?\n/);
      let openRef = null;
      for (const line of lines) {
        const match = line.match(
          /(?:button|link) "([^"]*Åpne dokumentet[^"]*)" \[ref=(e\d+)\]/,
        );
        if (match) {
          openRef = match[2];
          break;
        }
      }
      if (openRef) {
        await runPlaywrightCli(["click", openRef]);
        log(`Clicked 'Åpne dokumentet' (ref=${openRef})`);
      } else {
        log("Could not find 'Åpne dokumentet' in snapshot.");
        logIssue(
          "documents",
          "No 'Åpne dokumentet' button found in document detail",
        );
      }
      await sleep(3000);
      continue;
    }

    if (page === "document-pdf") {
      log("PDF document detected. Downloading...");
      fs.copyFileSync(snapPath, path.join(outputDir, "document.yml"));
      const dlCode = await runPlaywrightCli([
        "run-code",
        `async page => { const link = page.locator('a[href*="/pdf/"]').first(); const count = await link.count(); if (count > 0) { const [download] = await Promise.all([ page.waitForEvent('download'), link.click() ]); await download.saveAs('${outputDir.replace(/\\/g, "/")}/document.pdf'); return; } const lastNed = page.getByRole('link', { name: 'Last ned' }); const lastNedCount = await lastNed.count(); if (lastNedCount > 0) { const [download] = await Promise.all([ page.waitForEvent('download'), lastNed.click() ]); await download.saveAs('${outputDir.replace(/\\/g, "/")}/document.pdf'); return; } throw new Error('No PDF link found'); }`,
      ]);
      if (dlCode === 0 && fs.existsSync(path.join(outputDir, "document.pdf"))) {
        log(`PDF saved: ${path.join(outputDir, "document.pdf")}`);
      } else {
        logIssue("pdf-download", "PDF download failed", { outputDir });
        log("PDF download failed.");
      }
      log(`\nDocument verification complete. Format: pdf`);
      log(`Output: ${outputDir}`);
      return 0;
    }

    if (page === "document-html") {
      log("HTML document detected. Capturing...");
      fs.copyFileSync(snapPath, path.join(outputDir, "document.yml"));
      await runPlaywrightCli([
        "screenshot",
        "--filename",
        path.join(outputDir, "document_screenshot.png"),
        "--full-page",
      ]);
      log("Saved: document_screenshot.png (full-page)");
      const htmlResult = await runPlaywrightCliCapture([
        "eval",
        "document.documentElement.outerHTML",
      ]);
      if (htmlResult.code === 0 && htmlResult.stdout) {
        fs.writeFileSync(
          path.join(outputDir, "document.html"),
          htmlResult.stdout.replace(/^### Result\s*/i, ""),
        );
        log("Saved: document.html");
      }
      log(`\nDocument verification complete. Format: html`);
      log(`Output: ${outputDir}`);
      return 0;
    }

    if (step === 0) {
      const dokumenterUrl = resolveDokumenterUrl(config);
      if (dokumenterUrl) {
        log(`Unknown page state. Navigating to Dokumenter: ${dokumenterUrl}`);
        await runPlaywrightCli(["goto", dokumenterUrl]);
        await sleep(2000);
        continue;
      }
    }

    log(`Could not determine page state. Taking screenshot for manual review.`);
    await runPlaywrightCli([
      "screenshot",
      "--filename",
      path.join(outputDir, "document_screenshot.png"),
      "--full-page",
    ]);
    logIssue("documents", `Stuck on unknown page at step ${step + 1}`, {
      outputDir,
    });
    break;
  }

  log(`Output: ${outputDir}`);
  return 1;
}

async function handleValidate(config) {
  const outputDir = config.lastRunDir;
  if (!outputDir) {
    console.error("No output folder. Run a test first.");
    return 1;
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const snapshotPath = path.join(outputDir, `validate_${Date.now()}.yml`);
  await runPlaywrightCli(["snapshot", "--filename", snapshotPath]);

  if (!fs.existsSync(snapshotPath)) {
    console.error("Failed to take snapshot.");
    return 1;
  }

  const snapshotText = fs.readFileSync(snapshotPath, "utf8");
  const errors = parseValidationErrors(snapshotText);

  if (!errors.length) {
    console.log("No validation errors found. Form is ready to submit.");
    return 0;
  }

  console.log(`\n${errors.length} validation error(s) found:\n`);

  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    const fieldId = err.fieldId ? decodeURIComponent(err.fieldId) : "unknown";
    console.log(`  ${i + 1}. [${fieldId}] "${err.text}" (ref=${err.ref})`);
  }

  console.log("\nScrolling to each error and taking snapshots...\n");

  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    const fieldId = err.fieldId ? decodeURIComponent(err.fieldId) : null;

    const clickCode = await runPlaywrightCli(["click", err.ref]);
    if (clickCode !== 0) {
      console.log(`  ${i + 1}. Could not click error link ${err.ref}`);
      continue;
    }

    await sleep(500);

    const fieldSnapshotPath = path.join(
      outputDir,
      `validation_error_${i + 1}.yml`,
    );
    await runPlaywrightCli(["snapshot", "--filename", fieldSnapshotPath]);

    if (fs.existsSync(fieldSnapshotPath)) {
      const fieldSnapshot = fs.readFileSync(fieldSnapshotPath, "utf8");

      let fieldContext = "";
      if (fieldId) {
        const fieldLines = fieldSnapshot.split(/\r?\n/);
        for (let j = 0; j < fieldLines.length; j++) {
          if (
            fieldLines[j].includes(`[aria-invalid`) ||
            fieldLines[j].includes(fieldId.replace(/\./g, "%2E"))
          ) {
            const start = Math.max(0, j - 5);
            const end = Math.min(fieldLines.length, j + 10);
            fieldContext = fieldLines.slice(start, end).join("\n");
            break;
          }
        }
      }

      if (fieldContext) {
        console.log(`  ${i + 1}. [${fieldId}] "${err.text}"`);
        console.log(`     Field context from snapshot:`);
        console.log(
          fieldContext
            .split("\n")
            .map((l) => `     ${l}`)
            .join("\n"),
        );
        console.log("");
      } else {
        console.log(
          `  ${i + 1}. [${fieldId}] "${err.text}" — scrolled to field, see ${fieldSnapshotPath}`,
        );
      }
    }
  }

  await runPlaywrightCliCapture(["eval", "window.scrollTo(0, 0)"]);

  console.log(
    `\nFix these ${errors.length} field(s), then run 'form-tester validate' again before submitting.`,
  );
  return errors.length;
}

module.exports = {
  handleCookies,
  handleSelectPerson,
  handleDocuments,
  handleValidate,
  fetchPersonOptions,
};
