import React, { useState, useEffect, useRef } from "react";
import { getQueue } from "../api.js";
import TechConsole from "./TechConsole.jsx";
import Dashboard from "./Dashboard.jsx";
import { t, dateLocale } from "../i18n.js";

const POLL_MS = 5000;

export default function ServiceDesk() {
  const [tab, setTab] = useState("queue");
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState({});
  const known = useRef(new Set());
  const firstLoadDone = useRef(false);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  useEffect(() => {
    let alive = true;
    async function poll() {
      if (selectedRef.current) return; // PAUSA: consola estática mientras hay un caso abierto
      try {
        const r = await getQueue();
        if (!alive || !r.tickets) return;
        const fresh = {};
        if (firstLoadDone.current) {
          for (const tk of r.tickets) if (!known.current.has(tk.key)) fresh[tk.key] = true;
        }
        r.tickets.forEach((tk) => known.current.add(tk.key));
        setTickets(r.tickets);
        setLoaded(true);
        firstLoadDone.current = true;
        if (Object.keys(fresh).length) {
          setFlash(fresh);
          setTimeout(() => { if (alive) setFlash({}); }, 4000);
        }
      } catch { /* reintenta al siguiente ciclo */ }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (selected) {
    return (
      <div className="single">
        <section className="pane">
          <div className="pane-h">
            <button className="back" onClick={() => setSelected(null)}>{t("back")}</button>
            <span className="dot tech" /> {t("attending")} {selected}
          </div>
          <TechConsole ticket={{ key: selected }} />
        </section>
      </div>
    );
  }

  return (
    <div className="single">
      <section className="pane">
        <div className="pane-h tabs">
          <button className={tab === "queue" ? "tab on" : "tab"} onClick={() => setTab("queue")}>
            {t("tabQueue")} {loaded && <span className="count">{tickets.length}</span>}
          </button>
          <button className={tab === "dash" ? "tab on" : "tab"} onClick={() => setTab("dash")}>{t("tabDash")}</button>
          <span className="live"><span className="pulse" /> {t("live")}</span>
        </div>
        {tab === "queue" ? (
          <div className="queue">
            {!loaded && <div className="empty"><span className="spinner big" /> {t("loadingQueue")}</div>}
            {loaded && tickets.length === 0 && (
              <div className="empty">{t("emptyQueue1")}<br />{t("emptyQueue2")}</div>
            )}
            {tickets.map((tk) => (
              <button key={tk.key} className={"q-item" + (flash[tk.key] ? " new" : "")} onClick={() => setSelected(tk.key)}>
                <div className="q-left">
                  <span className="q-key">{tk.key}</span>
                  <span className="q-title">{tk.title}</span>
                  <span className="q-meta">{tk.empresa} · {tk.sede} · {new Date(tk.created).toLocaleString(dateLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="q-right">
                  <span className="q-cat">{tk.category}</span>
                  <span className={"q-status s-" + tk.statusCategory}>{tk.status}</span>
                  {flash[tk.key] && <span className="q-new">{t("isNew")}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Dashboard />
        )}
      </section>
    </div>
  );
}
