import React, { useState, useEffect } from "react";
import UserIntake from "./components/UserIntake.jsx";
import ServiceDesk from "./components/ServiceDesk.jsx";
import { initLang, t } from "./i18n.js";

export default function App() {
  const [role, setRole] = useState("user");
  const [ready, setReady] = useState(false);

  useEffect(() => { initLang().then(() => setReady(true)); }, []);
  if (!ready) return null; // espera /api/config para saber el idioma

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">{t("appTitle")}</span>
          <span className="brand-sub">{t("appSub")}</span>
        </div>
        <div className="role-switch">
          <button className={role === "user" ? "on" : ""} onClick={() => setRole("user")}>{t("roleUser")}</button>
          <button className={role === "desk" ? "on" : ""} onClick={() => setRole("desk")}>{t("roleDesk")}</button>
        </div>
        <div className="env">DEMO</div>
        {/* LOGOS: reinserta aquí tus <img> de Peer Consulting e IT Expert
            (los que agregaste en producción), después de <div className="env"> */}
      </header>
      {role === "user" ? (
        <div className="single">
          <section className="pane">
            <div className="pane-h"><span className="dot user" /> {t("paneUser")}</div>
            <UserIntake />
          </section>
        </div>
      ) : (
        <ServiceDesk />
      )}
    </div>
  );
}
