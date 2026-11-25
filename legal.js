const legalThemeToggle = document.getElementById("legal-theme-toggle");
const legalPageKeys = new Set(["terms", "privacy", "dmca", "disclaimer"]);

function setLegalTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (legalThemeToggle) {
    legalThemeToggle.textContent = theme === "light" ? "Dark mode" : "Light mode";
    legalThemeToggle.setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} mode`);
  }
}

function reportLegalLoadError(message, error) {
  const detail = error instanceof Error ? error.message : String(error || "Unknown error");
  console.warn(message, detail.slice(0, 500));
}

function loadConfigScript() {
  if (window.IPTV_CONFIG) return Promise.resolve(window.IPTV_CONFIG);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/config.js";
    script.onload = () => window.IPTV_CONFIG
      ? resolve(window.IPTV_CONFIG)
      : reject(new Error("Config script loaded without IPTV_CONFIG."));
    script.onerror = () => reject(new Error("Could not load /config.js."));
    document.head.append(script);
  });
}

function normalizeLegalMetadata(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      reportLegalLoadError("Saved legal metadata is not valid JSON.", error);
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    company_name: String(value.company_name || "").trim().slice(0, 120),
    contact_email: String(value.contact_email || "").trim().slice(0, 254),
    effective_dates: value.effective_dates && typeof value.effective_dates === "object" && !Array.isArray(value.effective_dates)
      ? value.effective_dates
      : {},
  };
}

function readLocalLegalMetadata() {
  try {
    return normalizeLegalMetadata(localStorage.getItem("iptv-legal-metadata"));
  } catch (error) {
    reportLegalLoadError("Could not read the browser-local legal metadata fallback.", error);
    return null;
  }
}

async function fetchLegalMetadata() {
  const config = await loadConfigScript();
  if (typeof config.SUPABASE_URL !== "string" || !config.SUPABASE_URL.startsWith("https://")
      || typeof config.SUPABASE_ANON_KEY !== "string" || !config.SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or public key is not configured.");
  }

  const endpoint = new URL(`${config.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/app_settings`);
  endpoint.search = new URLSearchParams({ key: "eq.legal_metadata", select: "value" }).toString();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: config.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${config.SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(`Supabase request failed (HTTP ${response.status}${body?.code ? `, ${body.code}` : ""}).`);
    }
    const rows = await response.json();
    return normalizeLegalMetadata(Array.isArray(rows) ? rows[0]?.value : null);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadLegalPageContent() {
  const article = document.querySelector(".legal-document");
  const key = window.location.pathname.split("/").pop()?.replace(/\.html?$/i, "").toLowerCase();
  if (!article || !legalPageKeys.has(key)) return;

  let metadata = null;
  try {
    metadata = await fetchLegalMetadata();
  } catch (error) {
    reportLegalLoadError("Could not load legal metadata from Supabase; checking browser-local values.", error);
  }
  if (!metadata) metadata = readLocalLegalMetadata();
  if (!metadata) return;

  const date = String(metadata.effective_dates?.[key] || "");
  const dateElement = article.querySelector("[data-legal-effective-date]");
  if (dateElement && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    const [year, month, day] = date.split("-").map(Number);
    dateElement.dateTime = date;
    dateElement.textContent = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node => {
    let text = node.nodeValue;
    if (metadata.company_name) text = text.replace(/VisualStream Lab|\[Operator[’']s full legal name\]/g, metadata.company_name);
    if (metadata.contact_email) text = text.replace(/\[[^\]]*e-?mail[^\]]*\]/gi, metadata.contact_email);
    node.nodeValue = text;
  });
  if (metadata.company_name) {
    document.title = document.title.replace(/VisualStream Lab/g, metadata.company_name);
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = description.content.replace(/VisualStream Lab/g, metadata.company_name);
    const brand = document.querySelector(".legal-brand");
    if (brand) brand.setAttribute("aria-label", brand.getAttribute("aria-label").replace(/VisualStream Lab/g, metadata.company_name));
  }
}

setLegalTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");

legalThemeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  setLegalTheme(nextTheme);
  try {
    localStorage.setItem("iptv-theme", nextTheme);
  } catch (error) {
    console.warn("Could not save legal page theme preference.", error);
  }
});

void loadLegalPageContent().catch(error => {
  reportLegalLoadError("Could not render saved legal page content.", error);
});
