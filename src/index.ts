// 1. Cargar variables de entorno inmediatamente antes de cualquier otro módulo
import "./config/env";

import express from "express";
import cors from "cors";
import { connectDB, isMongoDBConnected } from "./db";
import { connectPostgres, isPostgresConnected, isPostgisEnabled } from "./config/postgres";
import { syncUSGSEarthquakes } from "./services/usgsService";
import earthquakeRoutes from "./routes/earthquakeRoutes";
import reportRoutes from "./routes/reportRoutes";
import spatialRoutes from "./routes/spatialRoutes";
import storeRoutes from "./routes/storeRoutes";
import arcgisRoutes from "./routes/arcgisRoutes";

const app = express();
const PORT = process.env.PORT || 4000;

// 2. Conectar a bases de datos de forma asíncrona y no bloqueante
connectDB();
connectPostgres();

// 3. Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// 4. Rutas de la API
app.use("/api/earthquakes", earthquakeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/spatial", spatialRoutes);
app.use("/api/store", storeRoutes);
app.use("/arcgis/rest", arcgisRoutes);
app.use("/api/arcgis", arcgisRoutes);

// Endpoint de diagnóstico de salud y estado de bases de datos
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "OK",
    databases: {
      mongodb: {
        connected: isMongoDBConnected(),
        mode: isMongoDBConnected() ? "base_datos_activa" : "memoria_contingencia"
      },
      postgres: {
        connected: isPostgresConnected(),
        postgis: isPostgisEnabled(),
        host: process.env.PGHOST || "localhost",
        port: process.env.PGPORT || "5432",
        database: process.env.PGDATABASE || "postgres"
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Tarea periódica de sincronización USGS en segundo plano
const startUSGSSyncTask = () => {
  const intervalMs = 15 * 60 * 1000; // 15 minutos

  // Sincronización inicial si MongoDB está listo
  setTimeout(() => {
    if (isMongoDBConnected()) {
      console.log("⏳ [USGS Sync] Iniciando sincronización de sismos con la USGS...");
      syncUSGSEarthquakes()
        .then((stats) => {
          console.log(`✅ [USGS Sync] Sincronización USGS completada. Nuevos sismos: ${stats.added}`);
        })
        .catch((err) => {
          console.error("❌ [USGS Sync] Error en la sincronización:", err.message);
        });
    } else {
      console.log("ℹ️ [USGS Sync] Modo contingencia activo: Sismos cargados desde memoria local.");
    }
  }, 2000);

  // Intervalo cada 15 minutos
  setInterval(async () => {
    if (isMongoDBConnected()) {
      try {
        const stats = await syncUSGSEarthquakes();
        console.log(`✅ [USGS Sync] Sincronización periódica completada. Nuevos sismos: ${stats.added}`);
      } catch (err) {
        console.error("❌ [USGS Sync] Error en la sincronización periódica:", (err as Error).message);
      }
    }
  }, intervalMs);
};

// 5. Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo exitosamente en el puerto ${PORT}`);
  console.log(`📡 URL Base: http://localhost:${PORT}`);
  console.log(`🗺️ ArcGIS REST Services: http://localhost:${PORT}/arcgis/rest/services`);
  console.log(`🩺 Diagnóstico: http://localhost:${PORT}/api/status`);
  startUSGSSyncTask();
});
