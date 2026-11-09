import { Request, Response } from "express";
import mongoose from "mongoose";
import { Report } from "../models/Report";
import { initialReports } from "./seedController";

// Copia en memoria para contingencia si MongoDB no está conectado
let memoryReports = JSON.parse(JSON.stringify(initialReports));

const formatReport = (r: any) => ({
  id: r._id ? r._id.toString() : r.id,
  earthquakeId: r.earthquakeId,
  reporterName: r.reporterName,
  phone: r.phone,
  locationName: r.locationName,
  lat: r.location?.coordinates ? r.location.coordinates[1] : r.lat,
  lng: r.location?.coordinates ? r.location.coordinates[0] : r.lng,
  affectedPeople: r.affectedPeople || 0,
  affectedHouses: r.affectedHouses || 0,
  needs: r.needs || [],
  description: r.description,
  images: r.images || [],
  status: r.status || "pending",
  date: typeof r.date === "string" ? r.date : new Date(r.date).toISOString()
});

// Obtiene todos los reportes de damnificados
export const getReports = async (req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(memoryReports.map(formatReport));
  }

  try {
    let dbReports = await Report.find().sort({ date: -1 });

    // Si está vacío, sembrar con initialReports
    if (dbReports.length === 0) {
      console.log("ℹ️ [MongoDB] Colección de reportes vacía. Sembrando datos iniciales...");
      await Report.insertMany(initialReports);
      dbReports = await Report.find().sort({ date: -1 });
    }
    
    res.json(dbReports.map(formatReport));
  } catch (error) {
    console.warn("⚠️ [MongoDB] Error al consultar reportes. Entregando respaldo en memoria:", (error as Error).message);
    res.json(memoryReports.map(formatReport));
  }
};

// Crea un nuevo reporte de damnificados
export const createReport = async (req: Request, res: Response) => {
  const {
    earthquakeId,
    reporterName,
    phone,
    locationName,
    lat,
    lng,
    affectedPeople,
    affectedHouses,
    needs,
    description,
    images,
    status
  } = req.body;

  // Si MongoDB está desconectado, guardar en memoria
  if (mongoose.connection.readyState !== 1) {
    const newMemoryReport = {
      _id: `rep-local-${Date.now()}`,
      earthquakeId,
      reporterName: reporterName || "Ciudadano",
      phone: phone || "",
      locationName: locationName || "Ubicación reportada",
      location: {
        type: "Point",
        coordinates: [Number(lng) || -74.0, Number(lat) || 4.5]
      },
      affectedPeople: Number(affectedPeople) || 0,
      affectedHouses: Number(affectedHouses) || 0,
      needs: needs || [],
      description: description || "Sin descripción",
      images: images || [],
      status: status || "pending",
      date: new Date()
    };

    memoryReports.unshift(newMemoryReport);
    return res.status(201).json(formatReport(newMemoryReport));
  }

  try {
    const newReport = new Report({
      earthquakeId,
      reporterName,
      phone,
      locationName,
      location: {
        type: "Point",
        coordinates: [lng, lat]
      },
      affectedPeople: affectedPeople || 0,
      affectedHouses: affectedHouses || 0,
      needs: needs || [],
      description,
      images: images || [],
      status: status || "pending"
    });

    const saved = await newReport.save();
    res.status(201).json(formatReport(saved));
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

// Actualiza el estado del reporte
export const updateReportStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (mongoose.connection.readyState !== 1) {
    const rIndex = memoryReports.findIndex((r: any) => (r._id === id || r.id === id));
    if (rIndex === -1) {
      return res.status(404).json({ message: "Reporte no encontrado en memoria" });
    }
    memoryReports[rIndex].status = status;
    return res.json(formatReport(memoryReports[rIndex]));
  }

  try {
    const updated = await Report.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    res.json(formatReport(updated));
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};
