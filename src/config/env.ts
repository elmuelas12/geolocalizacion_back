import path from "path";
import fs from "fs";
import dotenv from "dotenv";

/**
 * Cargador de Variables de Entorno Robusto y Multipropósito
 * Busca y carga archivos .env / .env.development en múltiples ubicaciones
 * para garantizar funcionamiento sin importar desde dónde se ejecute el backend.
 */
const candidates = [
  path.resolve(__dirname, "../../.env.development"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env.development"),
  path.resolve(process.cwd(), "geolocalizaci-n_back/.env.development"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "geolocalizaci-n_back/.env"),
  path.resolve(__dirname, "../../../.env.development"),
  path.resolve(__dirname, "../../../.env")
];

let loadedPath: string | null = null;

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
    if (!loadedPath) loadedPath = candidate;
  }
}

// Fallbacks seguros de desarrollo
if (!process.env.PORT) process.env.PORT = "4000";
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/portal_geografico_dev";
if (!process.env.PGHOST) process.env.PGHOST = "localhost";
if (!process.env.PGPORT) process.env.PGPORT = "5432";
if (!process.env.PGUSER) process.env.PGUSER = "postgres";
if (!process.env.PGDATABASE) process.env.PGDATABASE = "postgres";
if (!process.env.PGPASSWORD) process.env.PGPASSWORD = "adan1234";

if (loadedPath) {
  console.log(`📁 [Config] Variables de entorno cargadas desde: ${loadedPath}`);
} else {
  console.warn("⚠️ [Config] No se encontró archivo .env. Usando variables por defecto.");
}

export const ENV_LOADED = true;

