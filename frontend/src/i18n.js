// Idioma del frontend: lo dicta el backend vía GET /api/config (APP_LANG).
let LANG = "es";

export async function initLang() {
  try {
    const r = await fetch("/api/config");
    const j = await r.json();
    LANG = j.lang === "en" ? "en" : "es";
  } catch { /* backend caído: se queda en es */ }
  return LANG;
}
export const lang = () => LANG;
export const dateLocale = () => (LANG === "en" ? "en-US" : "es-PE");

const D = {
  es: {
    appTitle: "Mesa de Ayuda",
    appSub: "Asistente con IA · clasificación y resolución asistida",
    roleUser: "Usuario",
    roleDesk: "Mesa de servicio",
    paneUser: "Usuario · reportar un problema",
    greeting: "Hola, soy el asistente de mesa de ayuda. Cuéntame qué problema tienes y te ayudo a registrar el ticket.",
    typing: "Analizando con IA…",
    aiClassified: "✨ Clasificado por IA · ",
    aiDetected: "✨ Categoría detectada por IA · ",
    openJira: "Abrir en Jira ↗",
    fEmpresa: "Empresa", fSede: "Sede", fReportadoPor: "Reportado por",
    ticketNote: "Tu ticket fue enviado a la mesa de servicio. Un técnico lo atenderá en breve.",
    newReport: "Reportar otro problema",
    phWrite: "Escribe tu problema…", phDone: "Ticket registrado ✓", send: "Enviar",
    tabQueue: "Cola de atención", tabDash: "Dashboard", live: "en vivo",
    loadingQueue: "Cargando cola…",
    emptyQueue1: "Sin tickets activos este mes.", emptyQueue2: "Los reportes de los usuarios aparecerán aquí en segundos.",
    isNew: "NUEVO", back: "← Volver a la cola", attending: "Atendiendo",
    analyzingCase: (k) => `Analizando el caso ${k} con IA…`,
    proposal: "Propuesta de solución · IA",
    similar: (n) => `Casos similares (${n})`,
    seeLess: "Ver menos", seeMore: (n) => `Ver ${n} casos más`,
    askTitle: "Consultar al asistente", phAsk: "Pregunta al asistente…", askBtn: "Preguntar",
    applying: "Aplicando en Jira…", closeBtn: "Cerrar (resuelto)", escBtn: "Escalar",
    resolvedBanner: "✓ Ticket resuelto — movido a «Completed» en Jira.",
    escalatedBanner: "↑ Ticket escalado — movido a «Work in progress» en Jira.",
    openKey: (k) => ` Abrir ${k} ↗`, reportedByLine: "Reportado por",
    kpiTotal: (since) => `Tickets desde ${since}`, kpiResolved: "Resueltos", kpiProgress: "En progreso", kpiRate: "Tasa de resolución",
    byCategory: "Por categoría (IA)", byMonth: "Por mes", bySede: "Por sede", byEmpresa: "Por marca",
    insightTitle: "Resumen ejecutivo · IA", analyze: "✨ Analizar con IA", reAnalyze: "Actualizar análisis",
    analyzing: "Analizando…", generating: "Generando resumen ejecutivo…",
    insightHint: "Genera un análisis ejecutivo de las métricas con un clic.",
    recent: "Tickets recientes",
    thTicket: "Ticket", thTitle: "Título", thCat: "Categoría", thSede: "Sede", thStatus: "Estado", thDate: "Fecha",
    noData: "Sin datos aún.", noRows: "Aún no hay tickets en el periodo.", computing: "Calculando métricas…",
    months: { "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun", "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic" },
  },
  en: {
    appTitle: "Service Desk",
    appSub: "AI assistant · classification and assisted resolution",
    roleUser: "End user",
    roleDesk: "Service desk",
    paneUser: "End user · report a problem",
    greeting: "Hi, I'm the help desk assistant. Tell me what problem you're having and I'll help you register the ticket.",
    typing: "Analyzing with AI…",
    aiClassified: "✨ AI-classified · ",
    aiDetected: "✨ AI-detected category · ",
    openJira: "Open in Jira ↗",
    fEmpresa: "Company", fSede: "Site", fReportadoPor: "Reported by",
    ticketNote: "Your ticket was sent to the service desk. A technician will look into it shortly.",
    newReport: "Report another problem",
    phWrite: "Describe your problem…", phDone: "Ticket registered ✓", send: "Send",
    tabQueue: "Queue", tabDash: "Dashboard", live: "live",
    loadingQueue: "Loading queue…",
    emptyQueue1: "No active tickets this month.", emptyQueue2: "User reports will appear here within seconds.",
    isNew: "NEW", back: "← Back to queue", attending: "Handling",
    analyzingCase: (k) => `Analyzing case ${k} with AI…`,
    proposal: "Solution proposal · AI",
    similar: (n) => `Similar cases (${n})`,
    seeLess: "Show less", seeMore: (n) => `Show ${n} more cases`,
    askTitle: "Ask the assistant", phAsk: "Ask the assistant…", askBtn: "Ask",
    applying: "Applying in Jira…", closeBtn: "Close (resolved)", escBtn: "Escalate",
    resolvedBanner: "✓ Ticket resolved — moved to “Completed” in Jira.",
    escalatedBanner: "↑ Ticket escalated — moved to “Work in progress” in Jira.",
    openKey: (k) => ` Open ${k} ↗`, reportedByLine: "Reported by",
    kpiTotal: (since) => `Tickets since ${since}`, kpiResolved: "Resolved", kpiProgress: "In progress", kpiRate: "Resolution rate",
    byCategory: "By category (AI)", byMonth: "By month", bySede: "By site", byEmpresa: "By brand",
    insightTitle: "Executive summary · AI", analyze: "✨ Analyze with AI", reAnalyze: "Refresh analysis",
    analyzing: "Analyzing…", generating: "Generating executive summary…",
    insightHint: "Generate an executive analysis of the metrics with one click.",
    recent: "Recent tickets",
    thTicket: "Ticket", thTitle: "Title", thCat: "Category", thSede: "Site", thStatus: "Status", thDate: "Date",
    noData: "No data yet.", noRows: "No tickets in the period yet.", computing: "Computing metrics…",
    months: { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" },
  },
};

export function t(key, ...args) {
  const v = D[LANG][key] ?? D.es[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
}
export const monthName = (mm) => D[LANG].months[mm] || mm;
