import React, { useState, useEffect } from "react";
import { getDashboard, getInsight } from "../api.js";
import { t, monthName } from "../i18n.js";

function Bars({ data, max, color }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const top = max || Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bars">
      {entries.map(([k, v]) => (
        <div key={k} className="bar-row">
          <span className="bar-label" title={k}>{k}</span>
          <div className="bar-track"><div className={"bar-fill " + (color || "")} style={{ width: (v / top) * 100 + "%" }} /></div>
          <span className="bar-val">{v}</span>
        </div>
      ))}
      {entries.length === 0 && <div className="muted">{t("noData")}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [insight, setInsight] = useState(null);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    getDashboard().then(setD).catch((e) => setErr(e.message));
  }, []);

  async function analyze() {
    setThinking(true);
    try { const r = await getInsight(); setInsight(r.insight); }
    catch (e) { setInsight("Error: " + e.message); }
    setThinking(false);
  }

  if (err) return <div className="empty">Error: {err}</div>;
  if (!d) return <div className="empty"><span className="spinner big" /> {t("computing")}</div>;

  const maxMonth = Math.max(1, ...Object.values(d.byMonth || {}));

  return (
    <div className="dash">
      <div className="kpis">
        <div className="kpi"><span className="kpi-n">{d.total}</span><span className="kpi-l">{t("kpiTotal", d.since)}</span></div>
        <div className="kpi ok"><span className="kpi-n">{d.resolved}</span><span className="kpi-l">{t("kpiResolved")}</span></div>
        <div className="kpi warn"><span className="kpi-n">{d.inProgress}</span><span className="kpi-l">{t("kpiProgress")}</span></div>
        <div className="kpi"><span className="kpi-n">{d.resolutionRate}%</span><span className="kpi-l">{t("kpiRate")}</span></div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h4>{t("byCategory")}</h4>
          <Bars data={d.byCategory} color="c1" />
        </div>
        <div className="card">
          <h4>{t("byMonth")}</h4>
          <div className="months">
            {(d.months || []).map((m) => (
              <div key={m} className="month">
                <div className="month-bar" style={{ height: Math.max(8, (d.byMonth[m] / maxMonth) * 110) + "px" }} />
                <span className="month-n">{d.byMonth[m]}</span>
                <span className="month-l">{monthName(m.slice(5))}</span>
              </div>
            ))}
            {(!d.months || d.months.length === 0) && <div className="muted">{t("noData")}</div>}
          </div>
        </div>
        <div className="card">
          <h4>{t("bySede")}</h4>
          <Bars data={d.bySede} color="c2" />
        </div>
        <div className="card">
          <h4>{t("byEmpresa")}</h4>
          <Bars data={d.byEmpresa} color="c3" />
        </div>
      </div>

      <div className="card insight">
        <div className="insight-head">
          <h4>{t("insightTitle")}</h4>
          <button onClick={analyze} disabled={thinking}>{thinking ? t("analyzing") : insight ? t("reAnalyze") : t("analyze")}</button>
        </div>
        {thinking && <div className="muted"><span className="spinner" /> {t("generating")}</div>}
        {insight && !thinking && <pre className="insight-text">{insight}</pre>}
        {!insight && !thinking && <div className="muted">{t("insightHint")}</div>}
      </div>

      <div className="card">
        <h4>{t("recent")}</h4>
        <table className="recent">
          <thead><tr><th>{t("thTicket")}</th><th>{t("thTitle")}</th><th>{t("thCat")}</th><th>{t("thSede")}</th><th>{t("thStatus")}</th><th>{t("thDate")}</th></tr></thead>
          <tbody>
            {(d.recent || []).map((r) => (
              <tr key={r.key}>
                <td className="mono">{r.key}</td><td>{r.title}</td><td>{r.category || "—"}</td>
                <td>{r.sede || "—"}</td><td>{r.status}</td><td className="mono">{r.repDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!d.recent || d.recent.length === 0) && <div className="muted">{t("noRows")}</div>}
      </div>
    </div>
  );
}
