const j = (r) => r.json();
const post = (url, body) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j);

export const intake = (messages) => post("/api/intake", { messages });
export const getCase = (key) => fetch(`/api/case/${key}`).then(j);
export const askCase = (key, question) => post(`/api/case/${key}/ask`, { question });
export const resolveCase = (key, decision, note) => post(`/api/case/${key}/resolve`, { decision, note });
export const getQueue = () => fetch("/api/queue").then(j);
export const getDashboard = () => fetch("/api/dashboard").then(j);
export const getInsight = () => post("/api/dashboard/insight", {});
