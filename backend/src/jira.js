const MOCK = process.env.MOCK === "true";
const DOMAIN = process.env.JIRA_DOMAIN;
const BASE = `https://${DOMAIN}/rest/api/3`;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "SUP";
const ISSUE_TYPE_ID = process.env.JIRA_ISSUE_TYPE_ID || "10039";

function headers() {
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
  return { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };
}
function adf(text) {
  return {
    type: "doc", version: 1,
    content: String(text).split("\n").filter((p) => p.trim()).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}
// ADF -> texto plano (para reconstruir tickets leídos de Jira)
export function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) {
    return node.content.map(adfToText).join("") + (node.type === "paragraph" ? "\n" : "");
  }
  return "";
}
export function browseUrl(key) {
  return DOMAIN ? `https://${DOMAIN}/browse/${key}` : null;
}

export async function createIssue({ summary, descriptionText, labels }) {
  if (MOCK) return { key: `SUP-${Math.floor(100 + Math.random() * 900)}` };
  const fields = { project: { key: PROJECT_KEY }, summary, issuetype: { id: ISSUE_TYPE_ID }, description: adf(descriptionText) };
  if (labels && labels.length) fields.labels = labels;
  const r = await fetch(`${BASE}/issue`, { method: "POST", headers: headers(), body: JSON.stringify({ fields }) });
  if (r.status !== 201) throw new Error(`Jira createIssue ${r.status}: ${await r.text()}`);
  return await r.json();
}

export async function getIssue(key) {
  if (MOCK) return { key, summary: "Incidente de ejemplo", description: "Descripción de ejemplo", statusName: "Waiting for support", statusCategory: "new", labels: [], created: new Date().toISOString() };
  const r = await fetch(`${BASE}/issue/${key}?fields=summary,description,status,labels,created`, { headers: headers() });
  if (!r.ok) throw new Error(`Jira getIssue ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const f = j.fields || {};
  return {
    key: j.key,
    summary: f.summary || "",
    description: adfToText(f.description).trim(),
    statusName: f.status?.name || "",
    statusCategory: f.status?.statusCategory?.key || "",
    labels: f.labels || [],
    created: f.created || null,
  };
}

// Búsqueda con el endpoint nuevo (POST /search/jql) + paginación por nextPageToken
export async function searchIssues(jql, fields = ["summary", "status", "labels", "created"], cap = 3000) {
  if (MOCK) return [];
  const out = [];
  let nextPageToken = null;
  let guard = 0;
  while (guard++ < 200) {
    const body = { jql, fields, maxResults: 100 };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const r = await fetch(`${BASE}/search/jql`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Jira search ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const issues = j.issues || [];
    for (const it of issues) {
      const f = it.fields || {};
      out.push({
        key: it.key,
        summary: f.summary || "",
        statusName: f.status?.name || "",
        statusCategory: f.status?.statusCategory?.key || "",
        labels: f.labels || [],
        created: f.created || null,
      });
    }
    if (j.isLast || !j.nextPageToken || issues.length === 0 || out.length >= cap) break;
    nextPageToken = j.nextPageToken;
  }
  return out;
}

export async function addComment(key, text) {
  if (MOCK) return { id: "mock" };
  const r = await fetch(`${BASE}/issue/${key}/comment`, { method: "POST", headers: headers(), body: JSON.stringify({ body: adf(text) }) });
  if (r.status !== 201) throw new Error(`Jira addComment ${r.status}: ${await r.text()}`);
  return await r.json();
}
export async function listTransitions(key) {
  if (MOCK) return { transitions: [{ id: "111", name: "Resolve", to: { name: "Completed" } }, { id: "31", name: "Investigate", to: { name: "Work in progress" } }] };
  const r = await fetch(`${BASE}/issue/${key}/transitions`, { headers: headers() });
  if (!r.ok) throw new Error(`Jira transitions ${r.status}: ${await r.text()}`);
  return await r.json();
}
export async function transition(key, transitionId) {
  if (MOCK) return { ok: true };
  const r = await fetch(`${BASE}/issue/${key}/transitions`, { method: "POST", headers: headers(), body: JSON.stringify({ transition: { id: transitionId } }) });
  if (r.status !== 204) throw new Error(`Jira transition ${r.status}: ${await r.text()}`);
  return { ok: true };
}
