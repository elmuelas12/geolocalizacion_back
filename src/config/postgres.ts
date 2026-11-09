import "./env";
import { Pool } from "pg";

export const pgPool = new Pool({
  host: process.env.PGHOST || "localhost",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "adan1234",
  database: process.env.PGDATABASE || "postgres",
  port: parseInt(process.env.PGPORT || "5432", 10),
  connectionTimeoutMillis: 4000, // Timeout de 4s para no colgar el servidor
  idleTimeoutMillis: 10000,
});

let isPgConnected = false;
let isPostgisActive = false;

export const connectPostgres = async () => {
  let client;
  const host = process.env.PGHOST || "localhost";
  const port = process.env.PGPORT || "5432";
  const db = process.env.PGDATABASE || "postgres";
  const user = process.env.PGUSER || "postgres";

  try {
    console.log(`⏳ [PostgreSQL] Intentando conectar a ${host}:${port}/${db} (usuario: ${user})...`);
    client = await pgPool.connect();
    isPgConnected = true;
    console.log(`🔌 [PostgreSQL] Conectado exitosamente en ${host}:${port}/${db}`);
    
    // Verificar si la extensión PostGIS está activa
    try {
      const res = await client.query("SELECT PostGIS_Full_Version();");
      isPostgisActive = true;
      const versionStr = res.rows[0]?.postgis_full_version || "Activo";
      console.log(`🗺️ [PostGIS] Extensión espacial activa: ${versionStr.split(" ")[0]}`);
    } catch {
      // Intentar habilitar PostGIS automáticamente
      try {
        await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
        isPostgisActive = true;
        console.log(`🗺️ [PostGIS] Extensión espacial 'postgis' activada automáticamente.`);
      } catch {
        isPostgisActive = false;
        console.warn(`⚠️ [PostGIS] PostgreSQL está conectado, pero la extensión PostGIS no está instalada en '${db}'.`);
        console.warn(`   -> Para habilitarla en psql/pgAdmin: CREATE EXTENSION postgis;`);
      }
    }
  } catch (error) {
    isPgConnected = false;
    const msg = (error as Error).message;
    console.error(`❌ [PostgreSQL] Error de conexión: ${msg}`);

    if (msg.includes("ECONNREFUSED")) {
      console.warn("💡 [Diagnóstico PostgreSQL] El servicio de PostgreSQL no está corriendo en el puerto 5432.");
      console.warn("   -> Solución: En Windows abre Servicios (services.msc) e inicia 'postgresql-x64-XX', o ejecuta 'net start postgresql-x64-16'.");
    } else if (msg.includes("password authentication failed")) {
      console.warn(`💡 [Diagnóstico PostgreSQL] Contraseña incorrecta para el usuario '${user}'.`);
      console.warn("   -> Solución: Revisa PGPASSWORD en .env.development (actualmente: 'adan1234').");
    } else if (msg.includes("database") && msg.includes("does not exist")) {
      console.warn(`💡 [Diagnóstico PostgreSQL] La base de datos '${db}' no existe en tu servidor PostgreSQL.`);
      console.warn("   -> Solución: Crea la base de datos en pgAdmin o psql: CREATE DATABASE postgres;");
    }
    console.warn("🛡️ [Modo Resiliente] El servidor continuará operando y el frontend usará generadores espaciales en cliente.");
  } finally {
    if (client) {
      client.release();
    }
  }
};

export const isPostgresConnected = () => isPgConnected;
export const isPostgisEnabled = () => isPostgisActive;
