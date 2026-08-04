import "dotenv/config";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const project = process.env.GCP_PROJECT;
const location = process.env.GCP_LOCATION || "us-central1";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log("Proyecto:", project, "| Región:", location, "| Modelo:", model);
console.log("Credencial:", credPath || "(ADC por defecto)");

if (!project) { console.error("❌ Falta GCP_PROJECT en backend/.env"); process.exit(1); }
if (credPath && !fs.existsSync(credPath)) {
  console.error(`❌ No existe la llave en esa ruta:\n   ${credPath}\n   Mueve el .json ahí, o corrige la ruta/nombre en el .env.`);
  process.exit(1);
}

try {
  const ai = new GoogleGenAI({ vertexai: true, project, location });
  const r = await ai.models.generateContent({ model, contents: "Responde solo: OK" });
  console.log("✅ Respuesta de Gemini:", (r.text || "").trim());
} catch (e) {
  console.error("\n❌ Error al llamar a Gemini:\n", e.message || e);
}