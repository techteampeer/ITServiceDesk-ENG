import React, { useState, useEffect } from "react";
import { getCase, askCase, resolveCase } from "../api.js";
import { t } from "../i18n.js";

export default function TechConsole({ ticket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [qa, setQa] = useState([]);
  const [status, setStatus] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!ticket) { setData(null); setStatus(null); setQa([]); setShowAll(false); return; }
    setStatus(null); setQa([]); setShowAll(false);
    setLoading(true);
    getCase(ticket.key).then(setData).catch((e) => setData({ error: e.message })).finally(() => setLoading(false));
  }, [ticket]);

  if (!ticket) return null;
  if (loading || !data) return <div className="empty"><span className="spinner big" /> {t("analyzingCase", ticket.key)}</div>;
  if (data.error) return <div className="empty">Error: {data.error}</div>;

  const tk = data.ticket;
  const shown = showAll ? data.similar : data.similar.slice(0, 3);

  async function ask() {
    if (!q.trim() || asking) return;
    const question = q.trim();
    setQ("");
    setQa((a) => [...a, { q: question, a: "…" }]);
    setAsking(true);
    try {
      const r = await askCase(ticket.key, question);
      setQa((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, a: r.answer } : x)));
    } catch (e) {
      setQa((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, a: "Error: " + e.message } : x)));
    }
    setAsking(false);
  }
  async function resolve(decision) {
    if (resolving || status) return;
    setResolving(decision);
    try {
      await resolveCase(ticket.key, decision, data.proposedSolution);
      setStatus(decision === "escalate" ? "escalado" : "resuelto");
    } catch (e) {
      alert("Jira error: " + e.message);
    }
    setResolving(null);
  }

  return (
    <div className="console">
      <div className="ticket-card">
        <div className="tk-top">
          <span className="tk-key">{tk.key}</span>
          {tk.url && <a className="tk-link" href={tk.url} target="_blank" rel="noopener noreferrer">{t("openJira")}</a>}
        </div>
        <div className="ai-badge">{t("aiDetected")}{tk.category}</div>
        <div className="tk-title">{tk.title}</div>
        <div className="tk-meta">{tk.empresa} · {tk.sede} · {t("reportedByLine")} {tk.usuario}</div>
        <div className="tk-desc">{tk.summary}</div>
      </div>

      <div className="block">
        <h4>{t("proposal")}</h4>
        <pre className="solution">{data.proposedSolution}</pre>
      </div>

      <div className="block">
        <h4>{t("similar", data.similar.length)}</h4>
        <ul className="similar">
          {shown.map((s) => (<li key={s.id}><b>{s.titulo}</b><span>{s.solucion}</span></li>))}
        </ul>
        {data.similar.length > 3 && (
          <button className="link-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? t("seeLess") : t("seeMore", data.similar.length - 3)}
          </button>
        )}
      </div>

      <div className="block">
        <h4>{t("askTitle")}</h4>
        {qa.map((x, i) => (<div key={i} className="qa"><div className="q">{x.q}</div><div className="a">{x.a}</div></div>))}
        <div className="composer">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder={t("phAsk")} disabled={asking} />
          <button onClick={ask} disabled={asking}>{t("askBtn")}</button>
        </div>
      </div>

      {status ? (
        <div className={"resolve-banner " + status}>
          {status === "resuelto" ? t("resolvedBanner") : t("escalatedBanner")}
          {tk.url && <a href={tk.url} target="_blank" rel="noopener noreferrer">{t("openKey", tk.key)}</a>}
        </div>
      ) : (
        <div className="actions">
          <button className="btn-close" onClick={() => resolve("close")} disabled={!!resolving}>
            {resolving === "close" ? t("applying") : t("closeBtn")}
          </button>
          <button className="btn-esc" onClick={() => resolve("escalate")} disabled={!!resolving}>
            {resolving === "escalate" ? t("applying") : t("escBtn")}
          </button>
        </div>
      )}
    </div>
  );
}
