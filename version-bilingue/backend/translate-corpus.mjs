// ============================================================
// translate-corpus.mjs — genera data/corpus_en.json traduciendo
// titulo/solucion de data/corpus_es.json con Gemini (lotes de 12).
// `categoria` NO se traduce: se mantiene canónica (ES) para que el
// retrieval y los labels sigan funcionando en ambos idiomas.
//
// Uso:  node translate-corpus.mjs          (reanudable: conserva lo ya traducido)
// Requiere MOCK=false y credenciales de Vertex (igual que la app).
// Costo aprox: ~21 llamadas a gemini-2.5-flash (centavos).
// ============================================================
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateJSON } from "./src/gemini.js";

if (process.env.MOCK === "true") {
  console.error("MOCK=true: la traducción necesita Gemini real. Ejecuta con MOCK=false.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "data", "corpus_es.json");
const DST = path.join(__dirname, "data", "corpus_en.json");

const es = JSON.parse(fs.readFileSync(SRC, "utf-8"));
const done = fs.existsSync(DST) ? JSON.parse(fs.readFileSync(DST, "utf-8")) : [];
const doneIds = new Set(done.map((c) => c.id));
const pending = es.filter((c) => !doneIds.has(c.id));
console.log(`Corpus: ${es.length} casos · ya traducidos: ${done.length} · pendientes: ${pending.length}`);

const SYS = `You are a professional ES→EN translator for IT service desk records. I will give you a JSON array of cases with fields {id, titulo, solucion}. Translate "titulo" and "solucion" into natural, concise technical English (service-desk register). Keep placeholders like [NOMBRE], TDA-000 and product names (SAP, PixelPoint, EdgePort, NCR) unchanged. Respond ONLY with a JSON array of {id, titulo, solucion} in the same order. No extra text.`;

const BATCH = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [...done];

for (let i = 0; i < pending.length; i += BATCH) {
  const batch = pending.slice(i, i + BATCH).map(({ id, titulo, solucion }) => ({ id, titulo, solucion }));
  let tr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      tr = await generateJSON(SYS, JSON.stringify(batch));
      if (!Array.isArray(tr)) tr = tr.cases || tr.items || null;
      if (Array.isArray(tr) && tr.length === batch.length) break;
      throw new Error("respuesta con formato inesperado");
    } catch (e) {
      console.log(`  lote ${i / BATCH + 1}: reintento ${attempt}/3 (${String(e.message || e).slice(0, 80)})`);
      await sleep(2500 * attempt);
      tr = null;
    }
  }
  if (!tr) { console.error("Lote fallido; guardando avance y abortando (relanza para reanudar)."); break; }
  for (const t of tr) {
    const orig = es.find((c) => c.id === t.id);
    if (orig) out.push({ ...orig, titulo: t.titulo, solucion: t.solucion });
  }
  fs.writeFileSync(DST, JSON.stringify(out, null, 1), "utf-8"); // guarda avance en cada lote
  console.log(`  ${out.length}/${es.length} traducidos…`);
  await sleep(400);
}
console.log(out.length === es.length ? `✅ corpus_en.json completo (${out.length})` : `⏸ avance guardado: ${out.length}/${es.length}`);
