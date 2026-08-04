import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LANG } from "./i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Corpus por idioma: data/corpus_en.json cuando APP_LANG=en (con fallback a ES si no existe)
function loadCorpus() {
  const en = path.join(__dirname, "..", "data", "corpus_en.json");
  const es = path.join(__dirname, "..", "data", "corpus_es.json");
  if (LANG === "en" && fs.existsSync(en)) return JSON.parse(fs.readFileSync(en, "utf-8"));
  if (LANG === "en") console.warn("[retrieval] APP_LANG=en pero no existe data/corpus_en.json — usando corpus en español (ejecuta translate-corpus.mjs)");
  return JSON.parse(fs.readFileSync(es, "utf-8"));
}
const corpus = loadCorpus();

const STOP_ES = new Set("de la el en con se un una los las del al por para no es que se le su sin re tk".split(" "));
const STOP_EN = new Set("the a an of in on to for and or is are was were with at from by it this that not no does can we you they i be been has have had".split(" "));
const STOP = LANG === "en" ? STOP_EN : STOP_ES;

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");
const tokens = (s) => norm(s).split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));

// category llega SIEMPRE canónica (ES) — el corpus (es o en) conserva `categoria` canónica
export function retrieve(category, query, n = 5) {
  const q = new Set(tokens(query));
  let pool = corpus.filter((c) => c.categoria === category);
  if (pool.length < n) pool = corpus;
  return pool
    .map((c) => {
      const ct = new Set(tokens(`${c.titulo} ${c.solucion}`));
      let s = 0; for (const t of q) if (ct.has(t)) s++;
      return { c, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(({ c }) => c);
}
