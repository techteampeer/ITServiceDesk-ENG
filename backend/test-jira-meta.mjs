import "dotenv/config";

const DOMAIN = process.env.JIRA_DOMAIN;
const KEY = process.env.JIRA_PROJECT_KEY || "SUP";
const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

async function get(path) {
  const r = await fetch(`https://${DOMAIN}/rest/api/3${path}`, { headers });
  return { status: r.status, body: await r.text() };
}

console.log("Dominio:", DOMAIN, "| Key buscada:", KEY, "\n");

// 1) ¿Qué proyectos ve tu cuenta?
let r = await get(`/project/search`);
console.log("── Proyectos visibles ──", r.status);
try {
  const j = JSON.parse(r.body);
  (j.values || []).forEach((p) => console.log(`   key=${p.key}  id=${p.id}  "${p.name}"`));
} catch { console.log(r.body.slice(0, 300)); }

// 2) Tipos de incidencia válidos para crear en ese proyecto
r = await get(`/issue/createmeta/${KEY}/issuetypes`);
console.log(`\n── Tipos de incidencia para ${KEY} ──`, r.status);
try {
  const j = JSON.parse(r.body);
  (j.issueTypes || j.values || []).forEach((it) => console.log(`   id=${it.id}  "${it.name}"`));
} catch { console.log(r.body.slice(0, 400)); }