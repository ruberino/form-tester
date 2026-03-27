const fs = require("fs");
const { sanitizePersonOptions } = require("./utils");

function findPersonRefInSnapshot(snapshotText, personName) {
  const lines = snapshotText.split(/\r?\n/);
  let inRegion = false;
  let firstRef = null;
  for (const line of lines) {
    if (line.includes('region "Hvem vil du bruke Helsenorge')) inRegion = true;
    if (!inRegion) continue;
    const btnMatch = line.match(/button "([^"]*)" \[ref=(e\d+)\]/);
    if (btnMatch) {
      if (!firstRef) firstRef = btnMatch[2];
      if (btnMatch[1].includes(personName)) return btnMatch[2];
    }
  }
  return firstRef; // fallback: first button in region
}

function detectPage(snapshotText) {
  if (!snapshotText) return "unknown";
  if (snapshotText.includes("Hvem vil du bruke Helsenorge"))
    return "person-picker";
  if (
    snapshotText.includes("cookie") ||
    snapshotText.includes("informasjonskapsler")
  )
    return "cookies";
  if (
    snapshotText.includes('main "Dokumenter"') ||
    snapshotText.includes("Se detaljer")
  )
    return "document-list";
  if (snapshotText.includes("Åpne dokumentet")) return "document-detail";
  if (
    /href.*\/pdf\//i.test(snapshotText) ||
    /blob:/i.test(snapshotText) ||
    /\.pdf/i.test(snapshotText)
  )
    return "document-pdf";
  if (snapshotText.length > 2000) return "document-html";
  return "unknown";
}

function parseValidationErrors(snapshotText) {
  const lines = snapshotText.split(/\r?\n/);
  const errors = [];
  let inValidation = false;
  let validationIndent = null;

  for (const line of lines) {
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    if (!inValidation) {
      if (
        line.includes('status "Sjekk at følgende er riktig utfylt:"') ||
        line.includes('status "Sjekk at f')
      ) {
        inValidation = true;
        validationIndent = indent;
      }
      continue;
    }

    if (
      indent <= validationIndent &&
      !line.includes("list") &&
      !line.includes("listitem") &&
      !line.includes("link") &&
      line.trim().startsWith("-")
    ) {
      break;
    }

    const linkMatch = line.match(/link "([^"]+)" \[ref=(e\d+)\]/);
    if (linkMatch) {
      const errorText = linkMatch[1];
      const ref = linkMatch[2];
      errors.push({ text: errorText, ref, fieldId: null });
    }

    const urlMatch = line.match(/\/url:\s*"#([^"]+)"/);
    if (urlMatch && errors.length > 0 && !errors[errors.length - 1].fieldId) {
      errors[errors.length - 1].fieldId = urlMatch[1];
    }
  }

  return errors;
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

// --- Snapshot ref parsing for test generation ---

function parseSnapshotRefs(text) {
  const refs = {};
  const lines = text.split(/\r?\n/);
  const indentStack = [];

  for (const line of lines) {
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    while (
      indentStack.length > 0 &&
      indentStack[indentStack.length - 1].indent >= indent
    ) {
      indentStack.pop();
    }

    const match = line.match(/- (\w+) "([^"]*)".*?\[ref=(e\d+)\]/);
    if (match) {
      const [, role, name, ref] = match;
      const parentRef =
        indentStack.length > 0 ? indentStack[indentStack.length - 1].ref : null;
      refs[ref] = { role, name, parentRef };
      indentStack.push({ indent, ref, role, name });
      continue;
    }

    const noName = line.match(/- (\w+) \[ref=(e\d+)\]/);
    if (noName) {
      const [, role, ref] = noName;
      const parentRef =
        indentStack.length > 0 ? indentStack[indentStack.length - 1].ref : null;
      refs[ref] = { role, name: "", parentRef };
      indentStack.push({ indent, ref, role, name: "" });
      continue;
    }

    const textNode = line.match(/- (\w+) \[ref=(e\d+)\]:\s*(.+)/);
    if (textNode) {
      const [, role, ref, text] = textNode;
      const parentRef =
        indentStack.length > 0 ? indentStack[indentStack.length - 1].ref : null;
      refs[ref] = {
        role,
        name: "",
        parentRef,
        textContent: text.replace(/^"|"$/g, ""),
      };
      indentStack.push({ indent, ref, role, name: "" });
      continue;
    }

    const anyElement = line.match(/- (\w+)/);
    if (anyElement) {
      indentStack.push({ indent, ref: null, role: anyElement[1], name: "" });
    }
  }

  return refs;
}

function findGroupLabel(ref, refMap) {
  const info = refMap[ref];
  if (!info || !info.parentRef) return null;

  const parentRef = info.parentRef;
  const siblings = Object.entries(refMap).filter(
    ([, v]) => v.parentRef === parentRef,
  );

  for (const [, sib] of siblings) {
    if (
      sib.role === info.role &&
      sib.name &&
      sib.name.length > info.name.length
    ) {
      const prefixEnd = sib.name.lastIndexOf(" ");
      if (prefixEnd > 0) {
        return sib.name.substring(0, prefixEnd);
      }
    }
  }

  let current = parentRef;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    const parent = refMap[current];
    if (!parent) break;

    const parentSiblings = Object.entries(refMap).filter(
      ([, v]) => v.parentRef === current && v.textContent,
    );
    for (const [, sib] of parentSiblings) {
      if (
        sib.textContent &&
        sib.textContent.length > 5 &&
        sib.textContent !== "Velg én"
      ) {
        return sib.textContent;
      }
    }

    current = parent.parentRef;
  }

  return null;
}

function isNameUnique(name, role, refMap) {
  if (!name) return false;
  let count = 0;
  for (const info of Object.values(refMap)) {
    if (info.role === role && info.name === name) {
      count++;
      if (count > 1) return false;
    }
  }
  return true;
}

const ROLE_MAP = {
  textbox: "textbox",
  button: "button",
  link: "link",
  checkbox: "checkbox",
  radio: "radio",
  combobox: "combobox",
  listbox: "listbox",
  option: "option",
  heading: "heading",
  img: "img",
  tab: "tab",
  tabpanel: "tabpanel",
  menuitem: "menuitem",
  dialog: "dialog",
  navigation: "navigation",
  main: "main",
  banner: "banner",
  generic: null,
};

function refToLocator(ref, refMap) {
  const info = refMap[ref];
  if (!info)
    return `page.locator('[data-ref="${ref}"]') /* TODO: replace — ref=${ref} not found in snapshots */`;

  const role = info.role;
  const name = info.name;
  const pwRole = ROLE_MAP[role];
  const esc = (s) => s.replace(/'/g, "\\'");

  if (pwRole && name) {
    if (isNameUnique(name, role, refMap)) {
      return `page.getByRole('${pwRole}', { name: '${esc(name)}' })`;
    }

    if (role === "radio" || role === "checkbox") {
      const groupLabel = findGroupLabel(ref, refMap);
      if (groupLabel) {
        return `page.locator('fieldset, [role="group"], [role="radiogroup"]').filter({ hasText: '${esc(groupLabel)}' }).getByRole('${pwRole}', { name: '${esc(name)}' })`;
      }
    }

    return `page.getByRole('${pwRole}', { name: '${esc(name)}' }) /* TODO: ambiguous — ${Object.values(refMap).filter((v) => v.role === role && v.name === name).length} elements match */`;
  }

  if (name) {
    return `page.getByLabel('${esc(name)}')`;
  }

  return `page.locator('[data-ref="${ref}"]') /* TODO: ref=${ref}, role=${role} — replace with proper selector */`;
}

module.exports = {
  findPersonRefInSnapshot,
  detectPage,
  parseValidationErrors,
  extractPersonsFromSnapshotText,
  extractPersonsFromSnapshotFile,
  parseSnapshotRefs,
  findGroupLabel,
  isNameUnique,
  refToLocator,
  ROLE_MAP,
};
