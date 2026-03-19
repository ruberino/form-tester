const test = require("node:test");
const assert = require("node:assert/strict");

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
} = require("../form-tester");

test("extractFormId returns form id from skjemautfyller URL", () => {
  const url =
    "https://example.no/skjemautfyller/HV-SOS-1?pnr=24908196046";
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
  assert.equal(sanitizeSegment('HV:SOS*1'), "HVSOS1");
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
  const output =
    '["Uromantisk Direktør","Alpha","Uromantisk Direktør","Beta"]';
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
