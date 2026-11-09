import "./config/env";
import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn("⚠️ [MongoDB] MONGODB_URI no está definido en las variables de entorno.");
    console.warn("🛡️ [Modo Resiliente] El servidor continuará en modo de contingencia con datos en memoria.");
    return;
  }

  try {
    console.log("⏳ [MongoDB] Conectando a MongoDB...");
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout de 5s para no bloquear el arranque
      connectTimeoutMS: 5000,
      family: 4, // Fuerza IPv4 (127.0.0.1) para evitar fallos de resolución en Windows
    });
    isConnected = true;
    console.log(`🔌 [MongoDB] Conectado exitosamente: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    isConnected = false;
    const msg = (error as Error).message;
    console.error(`❌ [MongoDB] Error de conexión: ${msg}`);

    if (msg.includes("whitelist") || msg.includes("IP") || msg.includes("timed out") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND") || msg.includes("Server selection timed out")) {
      console.warn("💡 [Diagnóstico MongoDB Atlas] Es muy probable que tu dirección IP actual no esté en la lista blanca de MongoDB Atlas.");
      console.warn("   -> Solución 1: Ve a https://cloud.mongodb.com -> 'Network Access' -> 'Add IP Address' -> agrega '0.0.0.0/0' (Permitir desde cualquier lugar).");
      console.warn("   -> Solución 2: O cambia MONGODB_URI en .env.development para usar MongoDB local: mongodb://localhost:27017/portal_geografico_dev");
    } else if (msg.includes("bad auth") || msg.includes("Authentication failed")) {
      console.warn("💡 [Diagnóstico MongoDB] Error de autenticación: El usuario o contraseña en MONGODB_URI no son válidos.");
    }

    console.warn("🛡️ [Modo Resiliente] El servidor backend arrancó en modo contingencia (datos en memoria RAM) para que la aplicación funcione sin bloquearse.");
  }
};

export const isMongoDBConnected = () => isConnected && mongoose.connection.readyState === 1;
