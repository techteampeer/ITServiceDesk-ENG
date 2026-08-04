import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PARAMS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config", "params.json"), "utf-8")
);