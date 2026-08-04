import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CATEGORIES } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let catalog = { empresas: [], sedes: [] };
try {
  catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "catalog.json"), "utf-8"));
} catch { /* catálogo opcional */ }

export function slug(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CAT_BY_SLUG = Object.fromEntries(CATEGORIES.map((c) => [slug(c), c]));
const EMP_BY_SLUG = Object.fromEntries((catalog.empresas || []).map((e) => [e.slug || slug(e.nombre), e.nombre]));
const SEDE_BY_SLUG = Object.fromEntries((catalog.sedes || []).map((s) => [s.slug || slug(s.nombre), s.nombre]));
const titleCase = (s) => s.split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

// Construye los labels de un ticket (usado por la app y por el seed)
export function buildLabels({ category, sede, empresa, repDate, seed, extra } = {}) {
  const L = [];
  if (category) L.push("cat_" + slug(category));
  if (sede) L.push("sede_" + slug(sede));
  if (empresa) L.push("emp_" + slug(empresa));
  if (repDate) L.push("rep_" + String(repDate).replace(/-/g, "_")); // rep_2026_04_15
  if (seed) L.push("seed_demo");
  if (Array.isArray(extra)) L.push(...extra);
  return L;
}

// Interpreta los labels de un issue de Jira
export function parseLabels(labels = []) {
  const out = { category: null, sede: null, empresa: null, repDate: null, seed: false };
  for (const l of labels) {
    if (l.startsWith("cat_")) out.category = CAT_BY_SLUG[l.slice(4)] || titleCase(l.slice(4));
    else if (l.startsWith("sede_")) out.sede = SEDE_BY_SLUG[l.slice(5)] || titleCase(l.slice(5));
    else if (l.startsWith("emp_")) out.empresa = EMP_BY_SLUG[l.slice(4)] || titleCase(l.slice(4));
    else if (l.startsWith("rep_")) out.repDate = l.slice(4).replace(/_/g, "-");
    else if (l === "seed_demo") out.seed = true;
  }
  return out;
}
