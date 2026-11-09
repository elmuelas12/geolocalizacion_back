import { Request, Response } from "express";
import { Earthquake } from "../models/Earthquake";
import { Report } from "../models/Report";

export const initialEarthquakes = [
  {
    _id: "eq-choco-2026",
    title: "Sismo de Quibdó - Chocó",
    date: new Date("2026-08-24T14:32:00Z"),
    magnitude: 6.2,
    depth: 18,
    location: { type: "Point", coordinates: [-76.6502, 5.6983] }, // [longitud, latitud]
    region: "Chocó",
    affectedCount: 1250,
    victimsStatus: { critical: 45, minor: 320, safe: 885 },
    needs: [
      { type: "Carpas/Refugio", requested: 250, delivered: 120, unit: "unidades" },
      { type: "Agua Potable", requested: 5000, delivered: 3500, unit: "litros" },
      { type: "Alimentos", requested: 1200, delivered: 600, unit: "raciones" },
      { type: "Atención Médica", requested: 150, delivered: 90, unit: "consultas" }
    ]
  },
  {
    _id: "eq-cauca-2026",
    title: "Sismo de Popayán - Cauca",
    date: new Date("2026-08-20T08:15:00Z"),
    magnitude: 5.8,
    depth: 12,
    location: { type: "Point", coordinates: [-76.6063, 2.4419] }, // [longitud, latitud]
    region: "Cauca",
    affectedCount: 820,
    victimsStatus: { critical: 28, minor: 190, safe: 602 },
    needs: [
      { type: "Carpas/Refugio", requested: 180, delivered: 150, unit: "unidades" },
      { type: "Agua Potable", requested: 3000, delivered: 2800, unit: "litros" },
      { type: "Alimentos", requested: 800, delivered: 750, unit: "raciones" },
      { type: "Kits de Aseo", requested: 400, delivered: 220, unit: "kits" }
    ]
  },
  {
    _id: "eq-santander-2026",
    title: "Sismo de Mesa de los Santos",
    date: new Date("2026-08-18T22:04:00Z"),
    magnitude: 5.4,
    depth: 147,
    location: { type: "Point", coordinates: [-73.1189, 6.8286] }, // [longitud, latitud]
    region: "Santander",
    affectedCount: 150,
    victimsStatus: { critical: 2, minor: 15, safe: 133 },
    needs: [
      { type: "Carpas/Refugio", requested: 20, delivered: 20, unit: "unidades" },
      { type: "Agua Potable", requested: 500, delivered: 500, unit: "litros" },
      { type: "Kits de Aseo", requested: 50, delivered: 45, unit: "kits" }
    ]
  },
  {
    _id: "eq-armenia-1999",
    title: "Sismo de Armenia (Simulado Activo)",
    date: new Date("2026-08-10T13:19:00Z"),
    magnitude: 6.0,
    depth: 15,
    location: { type: "Point", coordinates: [-75.6811, 4.5339] }, // [longitud, latitud]
    region: "Quindío",
    affectedCount: 3500,
    victimsStatus: { critical: 120, minor: 850, safe: 2530 },
    needs: [
      { type: "Carpas/Refugio", requested: 800, delivered: 450, unit: "unidades" },
      { type: "Agua Potable", requested: 15000, delivered: 9000, unit: "litros" },
      { type: "Alimentos", requested: 4000, delivered: 2500, unit: "raciones" },
      { type: "Kits de Aseo", requested: 1500, delivered: 800, unit: "kits" }
    ]
  }
];

export const initialReports = [
  {
    _id: "rep-001",
    earthquakeId: "eq-choco-2026",
    reporterName: "María Liliana Córdoba",
    description: "Deslizamiento en el barrio El Reposo afectó a 8 viviendas. Familias en la intemperie. Necesitamos colchonetas y carpas urgentemente.",
    location: { type: "Point", coordinates: [-76.6620, 5.6895] },
    affectedPeople: 45,
    affectedHouses: 8,
    needs: ["Carpas/Refugio", "Alimentos", "Kits de Aseo"],
    images: [
      "https://images.unsplash.com/photo-1588693951525-fa1224855d04?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=600&auto=format&fit=crop&q=80"
    ],
    status: "pending",
    date: new Date("2026-08-24T15:10:00Z"),
    phone: "312 456 7890",
    locationName: "Barrio El Reposo, Quibdó"
  },
  {
    _id: "rep-002",
    earthquakeId: "eq-choco-2026",
    reporterName: "José Alirio Palacios",
    description: "El acueducto rural colapsó debido al sismo. Toda la vereda Las Mercedes está sin agua potable hace 24 horas. Riesgo de infecciones sanitarias.",
    location: { type: "Point", coordinates: [-76.6350, 5.7210] },
    affectedPeople: 180,
    affectedHouses: 0,
    needs: ["Agua Potable", "Kits de Aseo"],
    images: [
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80"
    ],
    status: "in_progress",
    date: new Date("2026-08-24T16:05:00Z"),
    phone: "315 987 6543",
    locationName: "Vereda Las Mercedes, Quibdó"
  },
  {
    _id: "rep-003",
    earthquakeId: "eq-choco-2026",
    reporterName: "Dra. Sandra Patiño",
    description: "Centro de salud de Istmina presenta grietas estructurales severas. Estamos atendiendo a la población en el parque central, pero nos faltan insumos médicos básicos.",
    location: { type: "Point", coordinates: [-76.6841, 5.1614] },
    affectedPeople: 90,
    affectedHouses: 1,
    needs: ["Atención Médica", "Carpas/Refugio"],
    status: "pending",
    date: new Date("2026-08-24T17:40:00Z"),
    phone: "311 222 3344",
    locationName: "Parque Central, Istmina"
  },
  {
    _id: "rep-004",
    earthquakeId: "eq-cauca-2026",
    reporterName: "Carlos Mario Benítez",
    description: "Derrumbe parcial de viviendas históricas en la Comuna 4 de Popayán. Varias personas heridas leves y escombros bloqueando la vía principal.",
    location: { type: "Point", coordinates: [-76.6090, 2.4435] },
    affectedPeople: 35,
    affectedHouses: 12,
    needs: ["Atención Médica", "Carpas/Refugio"],
    status: "resolved",
    date: new Date("2026-08-20T08:45:00Z"),
    phone: "300 765 4321",
    locationName: "Comuna 4, Popayán"
  },
  {
    _id: "rep-005",
    earthquakeId: "eq-cauca-2026",
    reporterName: "Hermana Teresa Ruiz",
    description: "El albergue de la iglesia San Francisco está saturado. Requerimos colchonetas, sábanas y víveres no perecederos para 60 niños y adultos mayores.",
    location: { type: "Point", coordinates: [-76.6045, 2.4402] },
    affectedPeople: 60,
    affectedHouses: 0,
    needs: ["Alimentos", "Carpas/Refugio"],
    status: "in_progress",
    date: new Date("2026-08-20T10:12:00Z"),
    phone: "320 555 1234",
    locationName: "Iglesia San Francisco, Popayán"
  },
  {
    _id: "rep-006",
    earthquakeId: "eq-santander-2026",
    reporterName: "Pedro Nel Rodríguez",
    description: "Caída de tejas y agrietamiento de muros en 3 colegios de Los Santos. No hay lesionados graves, pero se suspendieron clases preventivamente.",
    location: { type: "Point", coordinates: [-73.1195, 6.8290] }, // [longitud, latitud]
    affectedPeople: 15,
    affectedHouses: 3,
    needs: ["Kits de Aseo"],
    status: "resolved",
    date: new Date("2026-08-19T06:30:00Z"),
    phone: "318 444 8899",
    locationName: "Casco Urbano, Los Santos"
  },
  {
    _id: "rep-007",
    earthquakeId: "eq-armenia-1999",
    reporterName: "Julián Giraldo",
    description: "Simulacro de colapso en el centro de Armenia. 150 damnificados ficticios reportados para probar tiempos de respuesta logística de defensa civil.",
    location: { type: "Point", coordinates: [-75.6790, 4.5360] },
    affectedPeople: 150,
    affectedHouses: 45,
    needs: ["Alimentos", "Agua Potable", "Carpas/Refugio"],
    status: "in_progress",
    date: new Date("2026-08-11T09:00:00Z"),
    phone: "310 999 8888",
    locationName: "Plaza de Bolívar, Armenia"
  }
];

export const seedDatabase = async (req: Request, res: Response) => {
  try {
    // 1. Limpia las colecciones existentes
    await Earthquake.deleteMany({});
    await Report.deleteMany({});

    // 2. Inserta los registros iniciales
    const seededEvents = await Earthquake.insertMany(initialEarthquakes);
    const seededReports = await Report.insertMany(initialReports);

    res.json({
      message: "¡Base de datos MongoDB sembrada exitosamente!",
      earthquakesCount: seededEvents.length,
      reportsCount: seededReports.length
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
