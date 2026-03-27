const { saveConfig } = require("./config");

function resolveDokumenterUrl(config) {
  if (!config.dokumenterUrlTemplate) return "";
  let url = config.dokumenterUrlTemplate;
  if (url.includes("{PNR}")) {
    if (!config.pnr) return "";
    url = url.replace("{PNR}", config.pnr);
  }
  // If the URL is a relative path, prepend the base URL
  if (url.startsWith("/")) {
    const base =
      config.baseUrl ||
      (config.lastTestUrl
        ? (() => {
            try {
              return new URL(config.lastTestUrl).origin;
            } catch (e) {
              return "";
            }
          })()
        : "");
    if (base) url = `${base}${url}`;
  }
  return url;
}

function resolveFormUrl(input, config) {
  // If it's already a full URL, return as-is
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  const base = config.baseUrl || "";
  // If it's a path like /skjemautfyller/FORM-ID or skjemautfyller/FORM-ID
  if (input.includes("/")) {
    const p = input.startsWith("/") ? input : `/${input}`;
    return `${base}${p}`;
  }
  // It's just a form name like SLV-PasRapp-2020
  const skjema = config.skjemaUrl || "/skjemautfyller";
  return `${base}${skjema}/${input}`;
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

module.exports = {
  resolveDokumenterUrl,
  resolveFormUrl,
  extractPnrFromUrl,
  setPnrOnUrl,
  ensurePnrInUrl,
  extractFormId,
};
