import "dotenv/config";
import { createIssue, listTransitions } from "./src/jira.js";

console.log("Jira:", process.env.JIRA_DOMAIN, "| proyecto:", process.env.JIRA_PROJECT_KEY, "| MOCK:", process.env.MOCK);
if (process.env.MOCK === "true") { console.error("⚠  MOCK=true: pon MOCK=false en .env para probar Jira real."); process.exit(1); }

try {
  const t = await createIssue({
    summary: "[Prueba de conexión] Ticket desde la app",
    descriptionText: "Ticket de prueba creado por test-jira.mjs para validar la conexión.\nSi ves esto en SUP, la integración funciona. Puedes borrarlo.",
  });
  console.log("✅ Ticket creado:", t.key);
  const tr = await listTransitions(t.key);
  console.log("\nTransiciones disponibles (cópialas al .env):");
  for (const x of tr.transitions) console.log(`   id=${x.id}  ->  ${x.name}  (estado: ${x.to?.name})`);
} catch (e) {
  console.error("\n❌ Error con Jira:\n", e.message || e);
}