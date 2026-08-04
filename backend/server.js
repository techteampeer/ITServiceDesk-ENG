import "dotenv/config";
import express from "express";
import cors from "cors";
import { intakeSystem, synthSystem, followupSystem, singleShotSystem } from "./src/prompts.js";
import { generateJSON, generateText } from "./src/gemini.js";
import { retrieve } from "./src/retrieval.js";
import { PARAMS } from "./src/params.js";
import { buildLabels, parseLabels } from "./src/labels.js";
import * as jira from "./src/jira.js";
import { LANG, T, display, toCanonical, CATEGORIES_ES } from "./src/i18n.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
const CASES = new Map();

const PROJECT = process.env.JIRA_PROJECT_KEY || "SUP";
const todayISO = () => new Date().toISOString().slice(0, 10);
const DASHBOARD_START = process.env.DASHBOARD_START || "2026-04-01";
const QUEUE_JQL = process.env.QUEUE_JQL ||
  `project = ${PROJECT} AND statusCategory != Done AND created >= startOfMonth() AND (labels is EMPTY OR labels != seed_demo) ORDER BY created DESC`;

app.get("/api/health", (req, res) => res.json({ ok: true, mock: process.env.MOCK === "true", lang: LANG }));
app.get("/api/config", (req, res) => res.json({ lang: LANG }));

// ============ Intake (usuario) ============
app.post("/api/intake", async (req, res) => {
  try {
    const messages = req.body.messages || [];
    const transcript = messages.map((m) => (m.role === "user" ? "Usuario: " : "Asistente: ") + m.content).join("\n");
    const out = await generateJSON(intakeSystem(), transcript);
    if (out.action === "ready") {
      const category = toCanonical(out.category) || CATEGORIES_ES[2]; // canónica ES para labels/dashboard
      const descr =
        `${T.reportedBy}: ${PARAMS.usuario} (${PARAMS.correo})\n` +
        `${T.company}: ${PARAMS.empresa} — ${T.site}: ${PARAMS.sede}\n` +
        `${T.category}: ${display(category)}\n\n${out.summary}`;
      const labels = buildLabels({ category, sede: PARAMS.sede, empresa: PARAMS.empresa, repDate: todayISO() });
      const ticket = await jira.createIssue({ summary: `[${PARAMS.sede}] ${out.title}`, descriptionText: descr, labels });
      const rec = { key: ticket.key, category, title: out.title, summary: out.summary, url: jira.browseUrl(ticket.key), ...PARAMS };
      CASES.set(ticket.key, rec);
      return res.json({ action: "ready", message: out.message, ticket: { ...rec, category: display(rec.category) } });
    }
    res.json({ action: "ask", message: out.message });
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

// ============ Caso (técnico) ============
// Carga desde memoria o, si no está (seed / sesión previa), lo reconstruye desde Jira.
async function loadCase(key) {
  if (CASES.has(key)) return CASES.get(key);
  const issue = await jira.getIssue(key);
  const meta = parseLabels(issue.labels);
  const rec = {
    key: issue.key,
    category: meta.category || null,
    title: issue.summary.replace(/^\[[^\]]+\]\s*/, ""),
    summary: issue.description || issue.summary,
    empresa: meta.empresa || "—",
    sede: meta.sede || "—",
    usuario: "—",
    status: issue.statusName,
    url: jira.browseUrl(key),
  };
  CASES.set(key, rec);
  return rec;
}

app.get("/api/case/:key", async (req, res) => {
  try {
    const c = await loadCase(req.params.key);
    const similar = retrieve(c.category, `${c.summary} ${c.title}`, 5);
    const ctx = `Incidente:\nTítulo: ${c.title}\nCategoría: ${c.category}\nDescripción: ${c.summary}\n\nCasos similares resueltos:\n` +
      similar.map((s, i) => `${i + 1}. ${s.titulo} -> Solución: ${s.solucion}`).join("\n");
    const proposedSolution = await generateText(synthSystem(), ctx);
    res.json({ ticket: { ...c, category: c.category ? display(c.category) : T.uncategorized }, similar, proposedSolution });
  } catch (e) { console.error(e); res.status(404).json({ error: String(e.message || e) }); }
});

app.post("/api/case/:key/ask", async (req, res) => {
  try {
    const c = await loadCase(req.params.key);
    const similar = retrieve(c.category, c.summary, 5);
    const ctx = `Incidente: ${c.title} — ${c.summary}\nCasos similares:\n` +
      similar.map((s, i) => `${i + 1}. ${s.titulo} -> ${s.solucion}`).join("\n") +
      `\n\nConsulta del técnico: ${req.body.question}`;
    res.json({ answer: await generateText(followupSystem(), ctx) });
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

app.post("/api/case/:key/resolve", async (req, res) => {
  try {
    const { decision, note } = req.body;
    const text = (decision === "escalate" ? T.escalatedPrefix : T.resolvedPrefix) + (note || "");
    await jira.addComment(req.params.key, text);
    const tid = decision === "escalate" ? process.env.JIRA_TRANSITION_ESCALATE_ID : process.env.JIRA_TRANSITION_CLOSE_ID;
    let transitioned = false;
    if (tid) { await jira.transition(req.params.key, tid); transitioned = true; }
    res.json({ ok: true, decision, transitioned });
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

// ============ Integraciones (Teams / Power Automate / otros) ============
// POST /api/integrations/report  — intake de un solo tiro para canales externos.
// Body: { text: "descripcion del problema", usuario?, correo?, empresa?, sede? }
// Seguridad: header X-API-Key debe coincidir con INTEGRATION_API_KEY del entorno.
app.post("/api/integrations/report", async (req, res) => {
  try {
    const requiredKey = process.env.INTEGRATION_API_KEY;
    if (requiredKey && req.get("X-API-Key") !== requiredKey) {
      return res.status(401).json({ error: T.apiKeyError });
    }
    const text = (req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: T.missingText });

    const who = {
      usuario: req.body.usuario || PARAMS.usuario,
      correo: req.body.correo || PARAMS.correo,
      empresa: req.body.empresa || PARAMS.empresa,
      sede: req.body.sede || PARAMS.sede,
    };

    const out = await generateJSON(singleShotSystem(), (LANG === "en" ? "User: " : "Usuario: ") + text);
    const category = toCanonical(out.category) || CATEGORIES_ES[2];
    const title = out.title || text.slice(0, 80);
    const summary = out.summary || text;

    const descr =
      `${T.reportedBy}: ${who.usuario} (${who.correo}) — ${T.viaTeams}\n` +
      `${T.company}: ${who.empresa} — ${T.site}: ${who.sede}\n` +
      `${T.category}: ${display(category)}\n\n${summary}\n\n${T.originalMessage}:\n${text}`;
    const labels = buildLabels({ category, sede: who.sede, empresa: who.empresa, repDate: todayISO(), extra: ["canal_teams"] });
    const ticket = await jira.createIssue({ summary: `[${who.sede}] ${title}`, descriptionText: descr, labels });

    const rec = { key: ticket.key, category, title, summary, url: jira.browseUrl(ticket.key), ...who };
    CASES.set(ticket.key, rec);

    res.json({
      ok: true,
      key: ticket.key,
      url: rec.url,
      category: display(category),
      title,
      reply: out.reply || T.defaultReply(ticket.key),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

// ============ Cola (técnico): tickets activos ============
app.get("/api/queue", async (req, res) => {
  try {
    const issues = await jira.searchIssues(QUEUE_JQL, ["summary", "status", "labels", "created"], 100);
    const tickets = issues.map((it) => {
      const meta = parseLabels(it.labels);
      return {
        key: it.key,
        title: it.summary.replace(/^\[[^\]]+\]\s*/, ""),
        category: meta.category ? display(meta.category) : null,
        sede: meta.sede || "—",
        empresa: meta.empresa || "—",
        status: it.statusName,
        statusCategory: it.statusCategory,
        created: it.created,
      };
    });
    res.json({ count: tickets.length, tickets });
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

// ============ Dashboard (supervisor) ============
let dashCache = { at: 0, data: null };
async function computeDashboard() {
  const jql = `project = ${PROJECT} ORDER BY created DESC`;
  const issues = await jira.searchIssues(jql, ["summary", "status", "labels", "created"], 5000);
  const inc = (o, k) => { if (k) o[k] = (o[k] || 0) + 1; };
  const byStatus = {}, byStatusCategory = {}, byCategory = {}, bySede = {}, byEmpresa = {}, byMonth = {};
  let total = 0, resolved = 0, inProgress = 0, pending = 0;
  const recent = [];
  for (const it of issues) {
    const meta = parseLabels(it.labels);
    if (!meta.repDate || meta.repDate < DASHBOARD_START) continue; // por fecha de reporte (label), desde abril
    total++;
    inc(byStatus, it.statusName);
    inc(byStatusCategory, it.statusCategory);
    inc(byCategory, meta.category ? display(meta.category) : null);
    inc(bySede, meta.sede);
    inc(byEmpresa, meta.empresa);
    inc(byMonth, meta.repDate.slice(0, 7)); // YYYY-MM
    if (it.statusCategory === "done") resolved++;
    else if (it.statusCategory === "indeterminate") inProgress++;
    else pending++;
    if (recent.length < 12) recent.push({ key: it.key, title: it.summary.replace(/^\[[^\]]+\]\s*/, ""), category: meta.category ? display(meta.category) : null, sede: meta.sede, empresa: meta.empresa, status: it.statusName, repDate: meta.repDate });
  }
  const months = Object.keys(byMonth).sort();
  return { total, resolved, inProgress, pending, resolutionRate: total ? Math.round((resolved / total) * 100) : 0, byStatus, byStatusCategory, byCategory, bySede, byEmpresa, byMonth, months, recent, since: DASHBOARD_START };
}

app.get("/api/dashboard", async (req, res) => {
  try {
    if (!req.query.fresh && dashCache.data && Date.now() - dashCache.at < 30000) return res.json(dashCache.data);
    const data = await computeDashboard();
    dashCache = { at: Date.now(), data };
    res.json(data);
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

app.post("/api/dashboard/insight", async (req, res) => {
  try {
    const d = (dashCache.data && Date.now() - dashCache.at < 30000) ? dashCache.data : await computeDashboard();
    const top = Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const ctx = LANG === "en"
      ? `Service desk metrics since ${d.since}.\n` +
        `Total: ${d.total}. Resolved: ${d.resolved}. In progress: ${d.inProgress}. Pending: ${d.pending}. Resolution rate: ${d.resolutionRate}%.\n` +
        `Top categories: ${top.map(([k, v]) => `${k} (${v})`).join(", ")}.\n` +
        `By month: ${d.months.map((m) => `${m}: ${d.byMonth[m]}`).join(", ")}.`
      : `Métricas de mesa de ayuda desde ${d.since}.\n` +
        `Total: ${d.total}. Resueltos: ${d.resolved}. En progreso: ${d.inProgress}. Pendientes: ${d.pending}. Tasa de resolución: ${d.resolutionRate}%.\n` +
        `Top categorías: ${top.map(([k, v]) => `${k} (${v})`).join(", ")}.\n` +
        `Por mes: ${d.months.map((m) => `${m}: ${d.byMonth[m]}`).join(", ")}.`;
    const sys = LANG === "en"
      ? "You are an IT operations analyst. From these service desk metrics, write a brief executive summary in English (3-4 bullet points): where volume concentrates, the month-over-month trend, and 1-2 actionable recommendations. Concrete and direct."
      : "Eres un analista de operaciones de TI. A partir de estas métricas de mesa de ayuda, escribe un resumen ejecutivo breve en español (3 a 4 viñetas): qué concentra el volumen, la tendencia por mes y 1-2 recomendaciones accionables. Concreto y directo.";
    res.json({ insight: await generateText(sys, ctx) });
  } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
});

app.get("/api/jira/transitions/:key", async (req, res) => {
  try { res.json(await jira.listTransitions(req.params.key)); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// ============ Fusión fullstack (producción): sirve el build de React ============
// El build de Vite se copia a backend/public en el Dockerfile. Debe ir DESPUÉS de las rutas /api.
const PUB = path.join(__dirname, "public");
if (fs.existsSync(PUB)) {
  app.use(express.static(PUB));
  app.get("*", (req, res) => res.sendFile(path.join(PUB, "index.html")));
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Backend en http://localhost:${PORT}  (MOCK=${process.env.MOCK === "true"})`));
