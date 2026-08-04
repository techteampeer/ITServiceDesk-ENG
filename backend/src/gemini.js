import { GoogleGenAI } from "@google/genai";

const MOCK = process.env.MOCK === "true";
let _client = null;
function client() {
  if (!_client) {
    _client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GCP_PROJECT,
      location: process.env.GCP_LOCATION || "us-central1",
    });
  }
  return _client;
}
const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const strip = (t) => (t || "").replace(/```json/gi, "").replace(/```/g, "").trim();

async function gen(system, user, json) {
  const config = { systemInstruction: system, temperature: 0.2 };
  if (json) config.responseMimeType = "application/json";
  const r = await client().models.generateContent({ model: MODEL(), contents: user, config });
  return r.text;
}

export async function generateJSON(system, user) {
  if (MOCK) return mockIntake(user);
  const t = await gen(system, user, true);
  try { return JSON.parse(strip(t)); }
  catch { return { action: "ready", message: "Registrado.", category: "Avisos operativos e informativos", title: "Incidente", summary: (t || "").slice(0, 300) }; }
}
export async function generateText(system, user) {
  if (MOCK) return mockText(user);
  return await gen(system, user, false);
}

function mockIntake(user) {
  const turns = (user.match(/Usuario:/g) || []).length;
  if (turns <= 1)
    return { action: "ask", message: "¿En qué local y en qué caja o impresora ocurre? ¿Ya intentaron reiniciar el servicio o el equipo?" };
  return {
    action: "ready",
    message: "Gracias. Registro el ticket con la información brindada.",
    category: "Impresión de boletas y comandas",
    title: "No imprime boletas/comandas en caja",
    summary: "La caja no imprime boletas ni comandas. Reportado hoy. Aún no se reinicia el servicio de impresión. Local y caja indicados por el usuario.",
  };
}
function mockText(user) {
  if (/Consulta del técnico/i.test(user))
    return "Según los casos similares: valida la conexión con el control de impresión (EdgePort/Printers) y reinicia el servicio de cola de impresión; luego imprime una página de prueba para confirmar.";
  return "Pasos sugeridos (según casos similares):\n1. Verificar conexión con el control de impresión (EdgePort / Printers).\n2. Reiniciar el servicio de cola de impresión.\n3. Reiniciar servicios ASSA_COMANDA / ASSA_SOVOS si aplica.\n4. Imprimir una página de prueba.\n5. Validar con el usuario que las boletas/comandas pendientes se impriman.";
}