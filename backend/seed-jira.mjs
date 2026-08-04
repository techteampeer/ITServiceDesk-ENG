// ============================================================
// seed-jira.mjs — Puebla SUP con tickets históricos de demo
// Uso:
//   node seed-jira.mjs --dry            <- simula (no toca Jira), muestra resumen
//   node seed-jira.mjs                  <- crea los tickets
// Parámetros opcionales:
//   --from=2026-04-01 --to=2026-06-30   rango histórico
//   --per-day=20                        tickets promedio por día
//   --july=4                            tickets abiertos de julio (para la cola)
// Todos los tickets llevan label seed_demo (limpieza futura: JQL labels = seed_demo)
// ============================================================
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createIssue, listTransitions, transition } from "./src/jira.js";
import { buildLabels, slug } from "./src/labels.js";
import { CATEGORIES } from "./src/prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "corpus_es.json"), "utf-8"));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "config", "catalog.json"), "utf-8"));

// ---------- parámetros ----------
const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const DRY = process.argv.includes("--dry");
const FROM = arg("from", "2026-04-01");
const TO = arg("to", "2026-06-30");
const PER_DAY = parseInt(arg("per-day", "20"), 10);
const JULY_OPEN = parseInt(arg("july", "4"), 10);

// ---------- RNG determinista (misma corrida = mismos datos) ----------
let s = 42;
const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const gauss = () => (rnd() + rnd() + rnd()) / 3; // campana simple

// ---------- distribuciones ----------
// pesos por categoría ~ proporciones reales del clustering (más operativos, menos SAP)
const CAT_W = [8, 14, 10, 13, 9, 12, 6, 15, 7, 6]; // alineado al orden de CATEGORIES
const catPool = CATEGORIES.flatMap((c, i) => Array(CAT_W[i]).fill(c));
// estados: 70% resuelto, 18% en progreso, 8% pendiente(sin transición), 4% cancelado -> aproximación con transiciones disponibles
const STATUS_POOL = [
  ...Array(70).fill("close"),
  ...Array(18).fill("escalate"),
  ...Array(8).fill("none"),
  ...Array(4).fill("cancel"),
];

const corpusByCat = {};
for (const c of corpus) (corpusByCat[c.categoria] ||= []).push(c);

function* dateRange(from, to) {
  const d = new Date(from + "T12:00:00Z"), end = new Date(to + "T12:00:00Z");
  while (d <= end) { yield d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 1); }
}
const isWeekend = (iso) => [0, 6].includes(new Date(iso + "T12:00:00Z").getUTCDay());

function makeTicket(dateISO, forceOpen = false) {
  const category = pick(catPool);
  const base = pick(corpusByCat[category] || corpus);
  const empresa = pick(catalog.empresas).nombre;
  const sede = pick(catalog.sedes).nombre;
  const status = forceOpen ? "none" : pick(STATUS_POOL);
  const title = base.titulo.length > 90 ? base.titulo.slice(0, 90) : base.titulo;
  const descr =
    `Reportado por: Encargado de tienda\n` +
    `Empresa: ${empresa} — Sede: ${sede}\n` +
    `Categoría: ${category}\n\n` +
    `${base.titulo}\n\nResolución histórica de referencia: ${base.solucion.slice(0, 220)}`;
  const labels = buildLabels({ category, sede, empresa, repDate: dateISO, seed: true });
  return { summary: `[${sede}] ${title}`, descr, labels, status, category, sede, empresa, dateISO };
}

// ---------- plan ----------
const plan = [];
for (const day of dateRange(FROM, TO)) {
  // menos volumen en fin de semana; variación diaria +/- 30%
  const base = isWeekend(day) ? PER_DAY * 0.55 : PER_DAY;
  const n = Math.max(1, Math.round(base * (0.7 + 0.6 * gauss())));
  for (let i = 0; i < n; i++) plan.push(makeTicket(day));
}
// julio: abiertos, para que la cola no dependa solo de lo grabado en vivo
const today = new Date().toISOString().slice(0, 10);
const julyStart = today.slice(0, 8) + "01";
for (let i = 0; i < JULY_OPEN; i++) {
  const d = new Date(julyStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.floor(rnd() * Math.max(1, new Date().getUTCDate() - 1)));
  plan.push(makeTicket(d.toISOString().slice(0, 10), true));
}

// ---------- resumen ----------
const by = (fn) => plan.reduce((o, t) => ((o[fn(t)] = (o[fn(t)] || 0) + 1), o), {});
console.log(`Plan: ${plan.length} tickets  (${FROM} → ${TO} a ~${PER_DAY}/día hábil + ${JULY_OPEN} abiertos de julio)`);
console.log("Por mes:      ", by((t) => t.dateISO.slice(0, 7)));
console.log("Por estado:   ", by((t) => t.status));
console.log("Por categoría:", Object.fromEntries(Object.entries(by((t) => t.category)).map(([k, v]) => [k.slice(0, 28), v])));
console.log("Por marca:    ", by((t) => t.empresa));
console.log("Por sede:     ", by((t) => t.sede));

if (DRY) { console.log("\n--dry: no se creó nada en Jira."); process.exit(0); }

// ---------- ejecución contra Jira ----------
const CLOSE_ID = process.env.JIRA_TRANSITION_CLOSE_ID;
const ESC_ID = process.env.JIRA_TRANSITION_ESCALATE_ID;
let CANCEL_ID = process.env.JIRA_TRANSITION_CANCEL_ID || null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, what) {
  for (let a = 1; a <= 5; a++) {
    try { return await fn(); }
    catch (e) {
      const msg = String(e.message || e);
      if (msg.includes(" 429") || msg.toLowerCase().includes("rate")) {
        const wait = 3000 * a;
        console.log(`   429 rate limit en ${what}; reintento ${a}/5 en ${wait / 1000}s…`);
        await sleep(wait);
      } else throw e;
    }
  }
  throw new Error(`Agotados reintentos: ${what}`);
}

console.log(`\nCreando ${plan.length} tickets en ${process.env.JIRA_DOMAIN} (proyecto ${process.env.JIRA_PROJECT_KEY || "SUP"})…`);
console.log("Estimado: ~" + Math.ceil((plan.length * 2 * 350) / 60000) + " min. Ctrl+C para abortar; puedes reanudar bajando --per-day o el rango.\n");

let created = 0, failed = 0;
const t0 = Date.now();
for (const t of plan) {
  try {
    const issue = await withRetry(() => createIssue({ summary: t.summary, descriptionText: t.descr, labels: t.labels }), "createIssue");
    // descubrir id de Cancel una sola vez (si existe en el workflow)
    if (t.status === "cancel" && CANCEL_ID === null) {
      try {
        const tr = await listTransitions(issue.key);
        const c = (tr.transitions || []).find((x) => /cancel/i.test(x.name));
        CANCEL_ID = c ? c.id : "";
      } catch { CANCEL_ID = ""; }
    }
    const tid = t.status === "close" ? CLOSE_ID : t.status === "escalate" ? ESC_ID : t.status === "cancel" ? CANCEL_ID : null;
    if (tid) await withRetry(() => transition(issue.key, tid), "transition");
    created++;
    if (created % 25 === 0) {
      const rate = created / ((Date.now() - t0) / 60000);
      console.log(`   ${created}/${plan.length} creados (${rate.toFixed(0)}/min)…`);
    }
    await sleep(250); // throttle suave
  } catch (e) {
    failed++;
    console.error(`   ✗ falló uno (${t.summary.slice(0, 40)}…): ${String(e.message || e).slice(0, 120)}`);
    if (failed > 15) { console.error("Demasiados fallos; abortando."); break; }
  }
}
console.log(`\n✅ Terminado: ${created} creados, ${failed} fallidos, en ${((Date.now() - t0) / 60000).toFixed(1)} min.`);
console.log(`Limpieza futura (JQL): labels = seed_demo`);
