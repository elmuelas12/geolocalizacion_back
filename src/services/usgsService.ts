import mongoose from "mongoose";
import { Earthquake } from "../models/Earthquake";

interface USGSFeature {
  id: string;
  properties: {
    title: string;
    time: number; // timestamp epoch en ms
    mag: number;
    place: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number]; // [longitud, latitud, profundidad]
  };
}

export const syncUSGSEarthquakes = async (): Promise<{ total: number; added: number }> => {
  // Si MongoDB no está conectado, omitir silenciosamente sin romper el servidor
  if (mongoose.connection.readyState !== 1) {
    console.warn("ℹ️ [USGS Sync] Omitiendo sincronización automática: MongoDB no está conectado.");
    return { total: 0, added: 0 };
  }

  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al consultar la USGS: ${response.statusText}`);
    }

    const data = await response.json();
    const features: USGSFeature[] = data.features || [];

    // Cuadro delimitador (bounding box) para Colombia:
    // Longitud: entre -82.0 y -66.0
    // Latitud: entre -4.5 y 13.5
    const minLng = -82.0;
    const maxLng = -66.0;
    const minLat = -4.5;
    const maxLat = 13.5;

    let addedCount = 0;

    for (const feature of features) {
      const [lng, lat, depth] = feature.geometry.coordinates;

      // Filtra por el cuadro delimitador
      if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
        const title = feature.properties.title || `Sismo en Colombia M ${feature.properties.mag}`;
        const date = new Date(feature.properties.time);
        
        // Verifica si este sismo ya está registrado en MongoDB
        const existing = await Earthquake.findOne({ title, date });
        if (existing) continue;

        const magnitude = feature.properties.mag || 3.0;
        const region = feature.properties.place || "Colombia";

        // Calcula un impacto inicial realista para sismos grandes de modo que las gráficas muestren datos inmediatamente
        let affectedCount = 0;
        let victimsStatus = { critical: 0, minor: 0, safe: 0 };
        let needs: { type: string; requested: number; delivered: number; unit: string }[] = [];

        if (magnitude >= 5.5) {
          // Cálculo dinámico basado en la escala de magnitud
          affectedCount = Math.round((magnitude - 5.0) * 1200);
          const critical = Math.round(affectedCount * 0.05);
          const minor = Math.round(affectedCount * 0.25);
          const safe = affectedCount - (critical + minor);
          
          victimsStatus = { critical, minor, safe };
          needs = [
            { type: "Carpas/Refugio", requested: Math.round(affectedCount * 0.2), delivered: 0, unit: "unidades" },
            { type: "Agua Potable", requested: affectedCount * 5, delivered: 0, unit: "litros" },
            { type: "Alimentos", requested: affectedCount * 2, delivered: 0, unit: "raciones" },
            { type: "Kits de Aseo", requested: Math.round(affectedCount * 0.25), delivered: 0, unit: "kits" }
          ];
        }

        const newEarthquake = new Earthquake({
          title,
          date,
          magnitude,
          depth: Math.round(depth),
          location: {
            type: "Point",
            coordinates: [lng, lat]
          },
          region,
          affectedCount,
          victimsStatus,
          needs
        });

        await newEarthquake.save();
        addedCount++;
      }
    }

    return { total: features.length, added: addedCount };
  } catch (error) {
    console.error("❌ Error al ejecutar el Servicio de Sincronización USGS:", error);
    throw error;
  }
};
