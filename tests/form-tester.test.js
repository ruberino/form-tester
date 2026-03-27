const test = require("node:test");
const assert = require("node:assert/strict");

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
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
  parseSnapshotRefs,
  findGroupLabel,
  isNameUnique,
  refToLocator,
  generateTestScript,
} = require("../form-tester");

test("extractFormId returns form id from skjemautfyller URL", () => {
  const url = "https://example.no/skjemautfyller/HV-SOS-1?pnr=24908196046";
  assert.equal(extractFormId(url), "HV-SOS-1");
});

test("extractPnrFromUrl reads pnr query parameter", () => {
  const url = "https://example.no/skjemautfyller/HV-SOS-1?pnr=123";
  assert.equal(extractPnrFromUrl(url), "123");
});

test("setPnrOnUrl adds pnr when missing", () => {
  const url = "https://example.no/skjemautfyller/HV-SOS-1";
  const updated = setPnrOnUrl(url, "555");
  assert.match(updated, /pnr=555/);
});

test("ensurePnrInUrl prompts when pnr missing", async () => {
  const config = { pnr: "" };
  const ask = async () => "999";
  const result = await ensurePnrInUrl(
    "https://example.no/skjemautfyller/HV-SOS-1",
    config,
    ask,
  );
  assert.match(result.url, /pnr=999/);
  assert.equal(result.pnr, "999");
  assert.equal(config.pnr, "999");
});

test("sanitizeSegment removes invalid path characters", () => {
  assert.equal(sanitizeSegment("HV:SOS*1"), "HVSOS1");
});

test("resolveDokumenterUrl expands PNR template", () => {
  const config = {
    dokumenterUrlTemplate: "/dokumenter?pnr={PNR}",
    pnr: "777",
  };
  assert.equal(resolveDokumenterUrl(config), "/dokumenter?pnr=777");
});

test("prioritizeRecommended moves recommended to first position", () => {
  const list = ["Alpha", "Uromantisk Direktør", "Beta"];
  const result = prioritizeRecommended(list, "Uromantisk Direktør");
  assert.deepEqual(result, ["Uromantisk Direktør", "Alpha", "Beta"]);
});

test("parsePersonList parses JSON output and dedupes", () => {
  const output = '["Uromantisk Direktør","Alpha","Uromantisk Direktør","Beta"]';
  const result = parsePersonList(output);
  assert.deepEqual(result, ["Uromantisk Direktør", "Alpha", "Beta"]);
});

test("parsePersonList extracts list from Result block", () => {
  const output = [
    "### Result",
    '["Person A","Person B"]',
    "### Page",
    "- Page Title: Example",
  ].join("\n");
  const result = parsePersonList(output);
  assert.deepEqual(result, ["Person A", "Person B"]);
});

test("getPersonas returns 4 personas", () => {
  const personas = getPersonas();
  assert.equal(personas.length, 4);
  assert.ok(personas.every((p) => p.id && p.name && p.description && p.traits));
});

test("getPersonaById returns correct persona", () => {
  const persona = getPersonaById("ung-mann");
  assert.equal(persona.name, "Ung mann");
  assert.equal(persona.traits.gender, "Mann");
  assert.equal(persona.traits.age, 25);
});

test("getPersonaById returns null for unknown id", () => {
  assert.equal(getPersonaById("nonexistent"), null);
});

test("formatPersonaList includes all personas plus noen and custom", () => {
  const list = formatPersonaList();
  assert.ok(list.includes("Ung mann"));
  assert.ok(list.includes("Gravid kvinne"));
  assert.ok(list.includes("Eldre kvinne"));
  assert.ok(list.includes("Kronisk syk mann"));
  assert.ok(list.includes("Noen"));
  assert.ok(list.includes("Lag egen"));
});

test("each persona has a unique id", () => {
  const personas = getPersonas();
  const ids = personas.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("promptScenario is exported as a function", () => {
  assert.equal(typeof promptScenario, "function");
});

// --- Recording tests ---

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "form-tester-test-"));
}

test("startRecording creates recording.json with empty commands", () => {
  const dir = makeTmpDir();
  const filePath = startRecording(dir);
  assert.equal(filePath, path.join(dir, "recording.json"));
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(data.commandCount, 0);
  assert.deepEqual(data.commands, []);
  assert.ok(data.startedAt);
  assert.equal(data.completedAt, null);
  fs.rmSync(dir, { recursive: true });
});

test("appendToRecording adds commands to recording file", () => {
  const dir = makeTmpDir();
  const filePath = startRecording(dir);
  appendToRecording(filePath, ["open", "https://example.com"]);
  appendToRecording(filePath, ["fill", "e1", "hello"]);
  appendToRecording(filePath, ["click", "e3"]);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(data.commandCount, 3);
  assert.deepEqual(data.commands[0].args, ["open", "https://example.com"]);
  assert.deepEqual(data.commands[1].args, ["fill", "e1", "hello"]);
  assert.deepEqual(data.commands[2].args, ["click", "e3"]);
  assert.ok(data.commands[0].timestamp);
  fs.rmSync(dir, { recursive: true });
});

test("finalizeRecording sets completedAt timestamp", () => {
  const dir = makeTmpDir();
  const filePath = startRecording(dir);
  appendToRecording(filePath, ["snapshot"]);
  const result = finalizeRecording(filePath);
  assert.equal(result, filePath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.ok(data.completedAt);
  assert.equal(data.commandCount, 1);
  fs.rmSync(dir, { recursive: true });
});

test("finalizeRecording returns null for missing file", () => {
  assert.equal(finalizeRecording("/nonexistent/recording.json"), null);
  assert.equal(finalizeRecording(null), null);
});

test("appendToRecording is resilient to missing file", () => {
  // Should not throw
  appendToRecording("/nonexistent/recording.json", ["click", "e1"]);
});

// --- Snapshot ref parsing tests ---

test("parseSnapshotRefs extracts refs with roles and names", () => {
  const snapshot = [
    "- generic [ref=e1]:",
    "  - main [ref=e2]:",
    '    - heading "Form Title" [level=1] [ref=e3]',
    '    - textbox "Fornavn" [ref=e5]',
    '    - button "Send inn" [ref=e9] [cursor=pointer]',
    '    - combobox "Velg sykehus" [ref=e13]:',
    '      - option "Oslo"',
    '    - radio "Ja" [ref=e20]',
    '    - checkbox "Godtar vilkår" [ref=e25]',
  ].join("\n");

  const refs = parseSnapshotRefs(snapshot);
  assert.equal(refs.e3.role, "heading");
  assert.equal(refs.e3.name, "Form Title");
  assert.equal(refs.e5.role, "textbox");
  assert.equal(refs.e5.name, "Fornavn");
  assert.equal(refs.e9.role, "button");
  assert.equal(refs.e9.name, "Send inn");
  assert.equal(refs.e13.role, "combobox");
  assert.equal(refs.e13.name, "Velg sykehus");
  assert.equal(refs.e20.role, "radio");
  assert.equal(refs.e20.name, "Ja");
  assert.equal(refs.e25.role, "checkbox");
  assert.equal(refs.e25.name, "Godtar vilkår");
  assert.equal(refs.e1.role, "generic");
  assert.equal(refs.e1.name, "");
});

test("parseSnapshotRefs tracks parent refs", () => {
  const snapshot = [
    "- main [ref=e1]:",
    "  - generic [ref=e2]:",
    '    - radio "Ja" [ref=e3]',
    '    - radio "Nei" [ref=e4]',
  ].join("\n");
  const refs = parseSnapshotRefs(snapshot);
  assert.equal(refs.e2.parentRef, "e1");
  assert.equal(refs.e3.parentRef, "e2");
  assert.equal(refs.e4.parentRef, "e2");
});

test("parseSnapshotRefs handles elements without names", () => {
  const snapshot = "- img [ref=e10]\n- main [ref=e2]";
  const refs = parseSnapshotRefs(snapshot);
  assert.equal(refs.e10.role, "img");
  assert.equal(refs.e10.name, "");
  assert.equal(refs.e2.role, "main");
  assert.equal(refs.e2.name, "");
});

// --- Disambiguation tests ---

test("isNameUnique returns true for unique names", () => {
  const refMap = {
    e1: { role: "button", name: "Send inn" },
    e2: { role: "button", name: "Lagre" },
    e3: { role: "radio", name: "Ja" },
  };
  assert.ok(isNameUnique("Send inn", "button", refMap));
  assert.ok(isNameUnique("Lagre", "button", refMap));
});

test("isNameUnique returns false for duplicate names", () => {
  const refMap = {
    e1: { role: "radio", name: "Nei" },
    e2: { role: "radio", name: "Nei" },
    e3: { role: "radio", name: "Ja" },
  };
  assert.ok(!isNameUnique("Nei", "radio", refMap));
  assert.ok(isNameUnique("Ja", "radio", refMap));
});

test("findGroupLabel finds question from sibling radio with longer name", () => {
  const refMap = {
    e10: { role: "generic", name: "", parentRef: null },
    e11: { role: "radio", name: "Høyt blodtrykk Ja", parentRef: "e10" },
    e12: { role: "radio", name: "Nei", parentRef: "e10" },
  };
  const label = findGroupLabel("e12", refMap);
  assert.equal(label, "Høyt blodtrykk");
});

test("findGroupLabel returns null when no context available", () => {
  const refMap = {
    e1: { role: "radio", name: "Nei", parentRef: null },
  };
  assert.equal(findGroupLabel("e1", refMap), null);
});

test("refToLocator disambiguates radios with same name using group label", () => {
  const snapshot = [
    "- generic [ref=e100]:",
    '  - radio "Allergi Ja" [ref=e104]',
    '  - radio "Nei" [ref=e106]',
    "- generic [ref=e200]:",
    '  - radio "Diabetes Ja" [ref=e204]',
    '  - radio "Nei" [ref=e206]',
  ].join("\n");

  const refs = parseSnapshotRefs(snapshot);
  const loc106 = refToLocator("e106", refs);
  const loc206 = refToLocator("e206", refs);

  // Both "Nei" radios should be disambiguated with group label
  assert.ok(
    loc106.includes("filter"),
    "e106 should be disambiguated with filter",
  );
  assert.ok(
    loc206.includes("filter"),
    "e206 should be disambiguated with filter",
  );
  assert.ok(
    loc106.includes("Allergi"),
    "e106 locator should reference Allergi",
  );
  assert.ok(
    loc206.includes("Diabetes"),
    "e206 locator should reference Diabetes",
  );
  assert.notEqual(loc106, loc206, "Disambiguated locators should differ");
});

test("refToLocator uses plain getByRole for unique names", () => {
  const refMap = {
    e1: { role: "button", name: "Send inn", parentRef: null },
    e2: { role: "button", name: "Lagre", parentRef: null },
  };
  const loc = refToLocator("e1", refMap);
  assert.equal(loc, "page.getByRole('button', { name: 'Send inn' })");
});

// --- Test generation tests ---

test("generateTestScript produces valid script from recording", () => {
  const dir = makeTmpDir();

  // Create a snapshot file for ref resolution
  const snapshotPath = path.join(dir, "form_loaded.yml");
  fs.writeFileSync(
    snapshotPath,
    [
      "- main [ref=e1]:",
      '  - textbox "Fornavn" [ref=e5]',
      '  - textbox "Etternavn" [ref=e6]',
      '  - button "Send inn" [ref=e9] [cursor=pointer]',
    ].join("\n"),
  );

  const recording = {
    version: "0.12.0",
    startedAt: "2026-03-26T10:00:00.000Z",
    completedAt: "2026-03-26T10:05:00.000Z",
    commandCount: 5,
    commands: [
      {
        args: ["open", "https://example.com/form"],
        timestamp: "2026-03-26T10:00:01Z",
      },
      {
        args: ["snapshot", "--filename", snapshotPath],
        timestamp: "2026-03-26T10:00:02Z",
      },
      { args: ["fill", "e5", "Ola"], timestamp: "2026-03-26T10:00:03Z" },
      { args: ["fill", "e6", "Nordmann"], timestamp: "2026-03-26T10:00:04Z" },
      { args: ["click", "e9"], timestamp: "2026-03-26T10:00:05Z" },
    ],
  };

  const config = {
    lastTestUrl: "https://example.com/skjemautfyller/TEST-FORM?pnr=123",
  };
  const script = generateTestScript(recording, dir, config);

  // Verify the generated script contains proper locators
  assert.ok(
    script.includes("page.goto('https://example.com/form')"),
    "should have goto",
  );
  assert.ok(
    script.includes("getByRole('textbox', { name: 'Fornavn' })"),
    "should resolve e5 to Fornavn textbox",
  );
  assert.ok(
    script.includes("getByRole('textbox', { name: 'Etternavn' })"),
    "should resolve e6 to Etternavn textbox",
  );
  assert.ok(
    script.includes("getByRole('button', { name: 'Send inn' })"),
    "should resolve e9 to Send inn button",
  );
  assert.ok(script.includes(".fill('Ola')"), "should fill Ola");
  assert.ok(script.includes(".fill('Nordmann')"), "should fill Nordmann");
  assert.ok(script.includes(".click()"), "should click");
  assert.ok(
    script.includes("context.tracing.start"),
    "should have tracing start",
  );
  assert.ok(
    script.includes("context.tracing.stop"),
    "should have tracing stop",
  );
  assert.ok(script.includes("trace.zip"), "should reference trace.zip");

  fs.rmSync(dir, { recursive: true });
});

test("generateTestScript handles unresolved refs with TODO", () => {
  const dir = makeTmpDir();

  const recording = {
    version: "0.12.0",
    startedAt: "2026-03-26T10:00:00.000Z",
    completedAt: null,
    commandCount: 1,
    commands: [{ args: ["click", "e99"], timestamp: "2026-03-26T10:00:01Z" }],
  };

  const config = {};
  const script = generateTestScript(recording, dir, config);
  assert.ok(script.includes("TODO"), "should have TODO for unresolved ref");
  assert.ok(script.includes("e99"), "should mention the ref");

  fs.rmSync(dir, { recursive: true });
});
