import "dotenv/config";

const DOMAIN = process.env.JIRA_DOMAIN;
const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };
const get = async (p) => { const r = await fetch(`https://${DOMAIN}/rest/api/3${p}`, { headers }); return { status: r.status, body: await r.text() }; };

console.log("Email en .env:", process.env.JIRA_EMAIL);
console.log("Token (primeros 8):", (process.env.JIRA_API_TOKEN || "").slice(0, 8), "…\n");

let r = await get(`/myself`);
console.log("── ¿Quién soy? ──", r.status);
try { const j = JSON.parse(r.body); console.log("   Cuenta:", j.displayName, "|", j.emailAddress, "| activo:", j.active); }
catch { console.log(r.body.slice(0, 300)); }

r = await get(`/project/search?maxResults=50`);
console.log("\n── Proyectos (con total) ──", r.status);
try { const j = JSON.parse(r.body); console.log("   total:", j.total); (j.values || []).forEach((p) => console.log(`   key=${p.key}  "${p.name}"`)); }
catch { console.log(r.body.slice(0, 300)); }