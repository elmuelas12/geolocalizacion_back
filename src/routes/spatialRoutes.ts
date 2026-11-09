import { Router } from "express";
import {
  getSismosEnMunicipios,
  getBufferImpactoSismo,
  getDistanciaReportesEpicentro,
  getConteoEmergenciasPorMunicipio,
  getAreaZonasRiesgo,
  getInterseccionRiesgoMunicipios,
  getCentroidesZonasRiesgo,
  getSismosAltaMagnitudEnRiesgo,
  getPoblacionEnRiesgo,
  getGeoJSONCapas,
  getTeseladoEspacial
} from "../controllers/spatialController";

const router = Router();

// Rutas de Consultas Espaciales (PostGIS - EPSG 9377)
router.get("/query-1", getSismosEnMunicipios);
router.get("/query-2", getBufferImpactoSismo);
router.get("/query-3", getDistanciaReportesEpicentro);
router.get("/query-4", getConteoEmergenciasPorMunicipio);
router.get("/query-5", getAreaZonasRiesgo);
router.get("/query-6", getInterseccionRiesgoMunicipios);
router.get("/query-7", getCentroidesZonasRiesgo);
router.get("/query-8", getSismosAltaMagnitudEnRiesgo);
router.get("/query-9", getPoblacionEnRiesgo);
router.get("/query-10", getGeoJSONCapas);
router.get("/query-11", getTeseladoEspacial);
router.get("/tessellation", getTeseladoEspacial);

export default router;
