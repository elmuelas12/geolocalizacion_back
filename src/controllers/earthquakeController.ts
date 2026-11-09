import { Request, Response } from "express";
import mongoose from "mongoose";
import { Earthquake } from "../models/Earthquake";
import { Report } from "../models/Report";
import { syncUSGSEarthquakes } from "../services/usgsService";
import { initialEarthquakes } from "./seedController";

// Copia en memoria para contingencia si MongoDB no está conectado
let memoryEarthquakes = JSON.parse(JSON.stringify(initialEarthquakes));

// Formateador estándar de sismos
const formatEvent = (e: any) => ({
  id: e._id ? e._id.toString() : e.id,
  title: e.title,
  date: typeof e.date === "string" ? e.date : new Date(e.date).toISOString(),
  magnitude: e.magnitude,
  depth: e.depth,
  lat: e.location?.coordinates ? e.location.coordinates[1] : e.lat,
  lng: e.location?.coordinates ? e.location.coordinates[0] : e.lng,
  region: e.region,
  affectedCount: e.affectedCount || 0,
  affectedHouses: e.affectedHouses || 0,
  victimsStatus: e.victimsStatus || { critical: 0, minor: 0, safe: 0 },
  needs: e.needs || []
});

// Obtiene todos los sismos con la agregación dinámica de reportes
export const getEarthquakes = async (req: Request, res: Response) => {
  // Modo de Contingencia si MongoDB está desconectado
  if (mongoose.connection.readyState !== 1) {
    return res.json(memoryEarthquakes.map(formatEvent));
  }

  try {
    let dbEvents = await Earthquake.find().sort({ date: -1 });

    // Auto-sembrado si la colección existe pero está vacía
    if (dbEvents.length === 0) {
      console.log("ℹ️ [MongoDB] Colección de sismos vacía. Sembrando datos iniciales...");
      await Earthquake.insertMany(initialEarthquakes);
      dbEvents = await Earthquake.find().sort({ date: -1 });
    }

    const mappedEvents = await Promise.all(
      dbEvents.map(async (e) => {
        // Consulta todos los reportes vinculados a este sismo específico
        const associatedReports = await Report.find({ earthquakeId: e._id.toString() });

        // Suma personas y viviendas de los reportes en el terreno
        const reportsPeopleSum = associatedReports.reduce((sum, r) => sum + r.affectedPeople, 0);
        const reportsHousesSum = associatedReports.reduce((sum, r) => sum + (r.affectedHouses || 0), 0);

        // Si hay reportes en el terreno, sobrescriben dinámicamente las estimaciones iniciales
        let affectedCount = e.affectedCount || 0;
        let affectedHouses = 0;
        let victimsStatus = { ...e.victimsStatus };
        let needs = [...e.needs];

        if (associatedReports.length > 0) {
          // Agrega la información de los reportes a los contadores
          affectedCount = reportsPeopleSum;
          affectedHouses = reportsHousesSum;

          // Estima la distribución crítico/leve/a salvo según la cantidad de personas afectadas en los reportes
          const critical = Math.round(reportsPeopleSum * 0.08);
          const minor = Math.round(reportsPeopleSum * 0.32);
          const safe = reportsPeopleSum - (critical + minor);
          victimsStatus = { critical, minor, safe };

          // Consolidación dinámica de suministros basados en los reportes de campo
          const dynamicNeedsMap: Record<string, { requested: number; delivered: number; unit: string }> = {
            "Carpas/Refugio": { requested: 0, delivered: 0, unit: "unidades" },
            "Agua Potable": { requested: 0, delivered: 0, unit: "litros" },
            "Alimentos": { requested: 0, delivered: 0, unit: "raciones" },
            "Kits de Aseo": { requested: 0, delivered: 0, unit: "kits" },
            "Atención Médica": { requested: 0, delivered: 0, unit: "consultas" }
          };

          // Inicializa requerimientos y entregas con el valor base cargado si coincide
          e.needs.forEach(n => {
            if (dynamicNeedsMap[n.type]) {
              dynamicNeedsMap[n.type].requested = n.requested || 0;
              dynamicNeedsMap[n.type].delivered = n.delivered || 0;
            }
          });

          // Acumula la cantidad solicitada según la cantidad de afectados de los reportes
          associatedReports.forEach(r => {
            r.needs.forEach((needType: string) => {
              if (dynamicNeedsMap[needType]) {
                let qty = 0;
                if (needType === "Agua Potable") qty = r.affectedPeople * 5; // 5 L por persona
                else if (needType === "Alimentos") qty = r.affectedPeople * 2; // 2 raciones por persona
                else if (needType === "Carpas/Refugio") qty = Math.ceil(r.affectedPeople / 4); // 1 carpa por cada 4 personas
                else if (needType === "Kits de Aseo") qty = Math.ceil(r.affectedPeople / 4); // 1 kit por cada 4 personas
                else if (needType === "Atención Médica") qty = Math.ceil(r.affectedPeople / 8); // 1 consulta por cada 8 personas

                dynamicNeedsMap[needType].requested += qty;

                // Si el reporte ya fue atendido, se suma también a lo entregado
                if (r.status === "resolved") {
                  dynamicNeedsMap[needType].delivered += qty;
                }
              }
            });
          });

          // Convierte el consolidado a la estructura final de suministros (muestra siempre las 5 categorías)
          needs = Object.entries(dynamicNeedsMap)
            .map(([type, val]) => ({
              type,
              requested: val.requested,
              delivered: Math.min(val.delivered, val.requested),
              unit: val.unit
            }));
        } else if (e.magnitude >= 5.0) {
          // Si es un sismo mayor sin reportes aún, cálculo dinámico basado en la magnitud y profundidad (Ley de Atenuación Sísmica)
          const factorProfundidad = Math.min(2.5, Math.max(0.4, 60 / Math.max(10, e.depth)));
          const estimatedAffected = Math.round(Math.pow(10, e.magnitude * 0.65 - 1.3) * factorProfundidad);
          
          affectedCount = Math.max(affectedCount, estimatedAffected);
          affectedHouses = Math.round(affectedCount / 4.2);

          const critical = Math.round(affectedCount * 0.08);
          const minor = Math.round(affectedCount * 0.32);
          const safe = affectedCount - (critical + minor);
          victimsStatus = { critical, minor, safe };

          // Cálculo automático dinámico de requerimientos de socorro
          const aguaReq = affectedCount * 5 * 3; // 5 L por día para 3 días
          const alimentosReq = affectedCount * 2 * 3; // 2 raciones por día para 3 días
          const carpasReq = Math.ceil(affectedCount / 4);
          const kitsReq = Math.ceil(affectedCount / 4);
          const atencionReq = Math.ceil(affectedCount / 8);

          const existingNeedsMap = new Map((e.needs || []).map(n => [n.type, n]));

          needs = [
            { 
              type: "Carpas/Refugio", 
              requested: carpasReq, 
              delivered: existingNeedsMap.get("Carpas/Refugio")?.delivered ?? Math.round(carpasReq * 0.45), 
              unit: "unidades" 
            },
            { 
              type: "Agua Potable", 
              requested: aguaReq, 
              delivered: existingNeedsMap.get("Agua Potable")?.delivered ?? Math.round(aguaReq * 0.60), 
              unit: "litros" 
            },
            { 
              type: "Alimentos", 
              requested: alimentosReq, 
              delivered: existingNeedsMap.get("Alimentos")?.delivered ?? Math.round(alimentosReq * 0.50), 
              unit: "raciones" 
            },
            { 
              type: "Kits de Aseo", 
              requested: kitsReq, 
              delivered: existingNeedsMap.get("Kits de Aseo")?.delivered ?? Math.round(kitsReq * 0.35), 
              unit: "kits" 
            },
            { 
              type: "Atención Médica", 
              requested: atencionReq, 
              delivered: existingNeedsMap.get("Atención Médica")?.delivered ?? Math.round(atencionReq * 0.40), 
              unit: "consultas" 
            }
          ];
        }

        return {
          id: e._id.toString(),
          title: e.title,
          date: e.date.toISOString(),
          magnitude: e.magnitude,
          depth: e.depth,
          lat: e.location.coordinates[1], // Latitud
          lng: e.location.coordinates[0], // Longitud
          region: e.region,
          affectedCount,
          affectedHouses,
          victimsStatus,
          needs
        };
      })
    );

    res.json(mappedEvents);
  } catch (error) {
    // Si falla MongoDB en runtime, devolver respaldo en memoria sin bloquear la interfaz
    console.warn("⚠️ [MongoDB] Error al consultar sismos. Entregando respaldo en memoria:", (error as Error).message);
    res.json(memoryEarthquakes.map(formatEvent));
  }
};

// Despacho de cargamento humanitario en vivo para un sismo (avanza las entregas hacia el 100%)
export const dispatchAidToEarthquake = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { supplyType = "all", percentIncrease = 25 } = req.body;

  // Si MongoDB está desconectado, despachar sobre el almacén en memoria
  if (mongoose.connection.readyState !== 1) {
    const eqIndex = memoryEarthquakes.findIndex((e: any) => (e._id === id || e.id === id));
    if (eqIndex === -1) {
      return res.status(404).json({ message: "Sismo no encontrado en almacén temporal" });
    }

    const eq = memoryEarthquakes[eqIndex];
    if (!eq.needs || eq.needs.length === 0) {
      eq.needs = [
        { type: "Carpas/Refugio", requested: 250, delivered: 50, unit: "unidades" },
        { type: "Agua Potable", requested: 5000, delivered: 1500, unit: "litros" },
        { type: "Alimentos", requested: 1200, delivered: 400, unit: "raciones" },
        { type: "Kits de Aseo", requested: 300, delivered: 100, unit: "kits" },
        { type: "Atención Médica", requested: 150, delivered: 50, unit: "consultas" }
      ];
    }

    eq.needs = eq.needs.map((n: any) => {
      if (supplyType === "all" || n.type === supplyType) {
        const increment = Math.ceil(n.requested * (percentIncrease / 100));
        n.delivered = Math.min(n.requested, n.delivered + increment);
      }
      return n;
    });

    return res.json({
      status: "success",
      message: `¡Cargamento humanitario despachado (Modo Memoria) para ${eq.region}!`,
      needs: eq.needs
    });
  }

  try {
    const eq = await Earthquake.findById(id);
    if (!eq) {
      return res.status(404).json({ message: "Sismo no encontrado" });
    }

    // Si el sismo no tenía suministros inicializados, se calculan dinámicamente
    if (!eq.needs || eq.needs.length === 0) {
      const factorProfundidad = Math.min(2.5, Math.max(0.4, 60 / Math.max(10, eq.depth)));
      const count = Math.max(eq.affectedCount || 0, Math.round(Math.pow(10, eq.magnitude * 0.65 - 1.3) * factorProfundidad));
      eq.needs = [
        { type: "Carpas/Refugio", requested: Math.ceil(count / 4), delivered: 0, unit: "unidades" },
        { type: "Agua Potable", requested: count * 15, delivered: 0, unit: "litros" },
        { type: "Alimentos", requested: count * 6, delivered: 0, unit: "raciones" },
        { type: "Kits de Aseo", requested: Math.ceil(count / 4), delivered: 0, unit: "kits" },
        { type: "Atención Médica", requested: Math.ceil(count / 8), delivered: 0, unit: "consultas" }
      ];
    }

    // Despacho de insumos: incrementa las entregas progresivamente
    eq.needs = eq.needs.map((n) => {
      if (supplyType === "all" || n.type === supplyType) {
        const increment = Math.ceil(n.requested * (percentIncrease / 100));
        n.delivered = Math.min(n.requested, n.delivered + increment);
      }
      return n;
    });

    await eq.save();

    res.json({
      status: "success",
      message: `¡Cargamento humanitario despachado con éxito a la región de ${eq.region}!`,
      needs: eq.needs
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// Sincroniza sismos desde el feed en tiempo real de la USGS
export const syncEarthquakes = async (req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({
      message: "MongoDB no está conectado. El backend está operando en modo contingencia.",
      totalFetched: 0,
      newEarthquakesAdded: 0
    });
  }

  try {
    const stats = await syncUSGSEarthquakes();
    res.json({
      message: "Sincronización con la USGS completada con éxito.",
      totalFetched: stats.total,
      newEarthquakesAdded: stats.added
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
