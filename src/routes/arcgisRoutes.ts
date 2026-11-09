import { Router } from "express";
import {
  getArcGISServerInfo,
  getArcGISServicesCatalog,
  getSismosFeatureServer,
  getSismosLayerInfo,
  querySismosArcGIS,
  getFallasFeatureServer,
  getFallasLayerInfo,
  queryFallasArcGIS,
  proxyArcGISRequest
} from "../controllers/arcgisController";

const router = Router();

// Proxy CORS y conversor GeoJSON para servicios ArcGIS REST externos
router.get("/proxy", proxyArcGISRequest);

// 1. Info del Servidor ArcGIS REST
router.get("/info", getArcGISServerInfo);

// 2. Directorio de Servicios REST
router.get("/services", getArcGISServicesCatalog);

// 3. FeatureServer de Sismos
router.get("/services/SismosColombia/FeatureServer", getSismosFeatureServer);
router.get("/services/SismosColombia/FeatureServer/0", getSismosLayerInfo);
router.get("/services/SismosColombia/FeatureServer/0/query", querySismosArcGIS);

// 4. FeatureServer de Fallas Geológicas
router.get("/services/FallasColombia/FeatureServer", getFallasFeatureServer);
router.get("/services/FallasColombia/FeatureServer/0", getFallasLayerInfo);
router.get("/services/FallasColombia/FeatureServer/0/query", queryFallasArcGIS);

export default router;
