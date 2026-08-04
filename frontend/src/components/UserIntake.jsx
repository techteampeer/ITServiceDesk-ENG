import React, { useState, useRef, useEffect } from "react";
import { intake } from "../api.js";
import { t } from "../i18n.js";

export default function UserIntake() {
  const GREETING = { role: "assistant", content: t("greeting") };
  const [msgs, setMsgs] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const end = useRef();

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, done]);

  async function send() {
    if (!input.trim() || busy || done) return;
    const next = [...msgs, { role: "user", content: input.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await intake(next);
      setMsgs((m) => [...m, { role: "assistant", content: r.message }]);
      if (r.action === "ready" && r.ticket) setDone(r.ticket);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "Error: " + e.message }]);
    }
    setBusy(false);
  }
  function reset() {
    setMsgs([GREETING]); setDone(null); setInput("");
  }

  return (
    <div className="chat">
      <div className="msgs">
        {msgs.map((m, i) => (<div key={i} className={"bubble " + m.role}>{m.content}</div>))}
        {busy && <div className="bubble assistant typing"><span className="spinner" /> {t("typing")}</div>}
        {done && (
          <div className="ticket-created">
            <div className="tc-head">
              <span className="tc-key">{done.key}</span>
              {done.url && <a className="tc-link" href={done.url} target="_blank" rel="noopener noreferrer">{t("openJira")}</a>}
            </div>
            <div className="ai-badge">{t("aiClassified")}{done.category}</div>
            <div className="tc-title">{done.title}</div>
            <div className="tc-fields">
              <div><span className="fl">{t("fEmpresa")}</span><span className="fv">{done.empresa}</span></div>
              <div><span className="fl">{t("fSede")}</span><span className="fv">{done.sede}</span></div>
              <div><span className="fl">{t("fReportadoPor")}</span><span className="fv">{done.usuario}</span></div>
            </div>
            <div className="tc-note">{t("ticketNote")}</div>
            <button className="new-report" onClick={reset}>{t("newReport")}</button>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={done ? t("phDone") : t("phWrite")}
          disabled={!!done}
        />
        <button onClick={send} disabled={busy || !!done}>{t("send")}</button>
      </div>
    </div>
  );
}
