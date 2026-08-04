// ============================================================
// i18n.js — idioma de la aplicación (backend)
// APP_LANG=es (default) | en   — se define por entorno (Cloud Run / .env)
// Las categorías CANÓNICAS siguen siendo las españolas: los slugs de los
// labels de Jira se derivan SIEMPRE de ellas, así el dashboard agrega
// igual los tickets históricos (seed) y los nuevos en cualquier idioma.
// ============================================================

export const LANG = (process.env.APP_LANG || "es").toLowerCase() === "en" ? "en" : "es";

// Canónicas (ES) — NO cambiar: definen los slugs cat_* existentes en Jira
export const CATEGORIES_ES = [
  "Impresión de boletas y comandas",
  "Inicio de aplicativo / servidor",
  "Avisos operativos e informativos",
  "Falla de dispositivo POS / periférico",
  "Cuenta abierta / anulación de orden",
  "Registro de datos en ticket",
  "Inicio de aplicativo en caja",
  "Fallas de aplicativo (comandas / boletas)",
  "Aplicativo restablecido por reinicio",
  "Servidor sin conexión",
];

// Traducción 1:1 para mostrar (mismo orden)
export const CATEGORIES_EN = [
  "Receipt & kitchen-order printing",
  "Application / server startup",
  "Operational & informational notices",
  "POS device / peripheral failure",
  "Open tab / order cancellation",
  "Ticket data entry issues",
  "Cash-register app startup",
  "Application failures (orders / receipts)",
  "App restored after restart",
  "Server offline",
];

const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const ES_BY_NORM = new Map(CATEGORIES_ES.map((c) => [normalize(c), c]));
const EN_TO_ES = new Map(CATEGORIES_EN.map((c, i) => [normalize(c), CATEGORIES_ES[i]]));
const ES_TO_EN = new Map(CATEGORIES_ES.map((c, i) => [c, CATEGORIES_EN[i]]));

// Lo que devuelva el modelo (en cualquier idioma) -> categoría canónica ES
export function toCanonical(name) {
  const n = normalize(name);
  return ES_BY_NORM.get(n) || EN_TO_ES.get(n) || null;
}

// Categoría canónica -> nombre a mostrar según idioma
export function display(canonical) {
  if (!canonical) return canonical;
  return LANG === "en" ? (ES_TO_EN.get(canonical) || canonical) : canonical;
}

// Lista de categorías a mostrar/embeber en prompts según idioma
export const CATEGORIES_DISPLAY = LANG === "en" ? CATEGORIES_EN : CATEGORIES_ES;

// Strings del backend (descripciones de ticket, respuestas por defecto)
const STR = {
  es: {
    reportedBy: "Reportado por",
    company: "Empresa",
    site: "Sede",
    category: "Categoría",
    viaTeams: "vía Teams",
    originalMessage: "Mensaje original",
    uncategorized: "Sin categoría",
    apiKeyError: "API key inválida o ausente",
    missingText: "Falta 'text' con la descripción del problema",
    defaultReply: (key) => `Tu reporte fue registrado con el ticket ${key}. La mesa de servicio lo atenderá en breve.`,
    resolvedPrefix: "[Resuelto por el técnico] ",
    escalatedPrefix: "[Escalado por el técnico] ",
  },
  en: {
    reportedBy: "Reported by",
    company: "Company",
    site: "Site",
    category: "Category",
    viaTeams: "via Teams",
    originalMessage: "Original message",
    uncategorized: "Uncategorized",
    apiKeyError: "Invalid or missing API key",
    missingText: "Missing 'text' with the problem description",
    defaultReply: (key) => `Your report was registered as ticket ${key}. The service desk will look into it shortly.`,
    resolvedPrefix: "[Resolved by technician] ",
    escalatedPrefix: "[Escalated by technician] ",
  },
};
export const T = STR[LANG];
