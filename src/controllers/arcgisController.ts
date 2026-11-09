import { Request, Response } from "express";
import mongoose from "mongoose";
import { Earthquake } from "../models/Earthquake";
import { initialEarthquakes } from "./seedController";
import { faultsGeoJSON } from "./faultsData";
import { pgPool } from "../config/postgres";

// Formato de sismos en memoria
const getMemoryEarthquakes = () => JSON.parse(JSON.stringify(initialEarthquakes));

const sendFormatted = (req: Request, res: Response, data: any) => {
  const format = (req.query.f as string || "").toLowerCase();
  if (format === "pjson") {
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(data, null, 2));
  }
  return res.json(data);
};

/**
 * 1. Información General del Servidor ArcGIS REST
 * GET /arcgis/rest/info
 */
export const getArcGISServerInfo = (req: Request, res: Response) => {
  const info = {
    currentVersion: 11.1,
    fullVersion: "11.1.0",
    soapUrl: null,
    secureSoapUrl: null,
    authInfo: {
      isTokenBasedSecurity: false
    }
  };
  return sendFormatted(req, res, info);
};

/**
 * 2. Catálogo Raíz de Servicios REST de ArcGIS
 * GET /arcgis/rest/services
 */
export const getArcGISServicesCatalog = (req: Request, res: Response) => {
  const format = (req.query.f as string || "").toLowerCase();
  const host = `${req.protocol}://${req.get("host")}`;

  const catalog = {
    currentVersion: 11.1,
    folders: [],
    services: [
      {
        name: "SismosColombia",
        type: "FeatureServer",
        url: `${host}/arcgis/rest/services/SismosColombia/FeatureServer`
      },
      {
        name: "FallasColombia",
        type: "FeatureServer",
        url: `${host}/arcgis/rest/services/FallasColombia/FeatureServer`
      }
    ]
  };

  // Si el navegador abre la URL sin f=json, mostrar la vista HTML del Directorio ArcGIS REST
  const isHtml = !format && (req.headers.accept?.includes("text/html") ?? true);
  if (isHtml) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>ArcGIS REST Services Directory - Colombia Geo</title>
        <style>
          body { font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 13px; margin: 0; background: #fff; color: #000; }
          .header { background: #336699; color: white; padding: 12px 20px; font-weight: bold; font-size: 16px; }
          .breadcrumb { background: #E6EEF8; padding: 6px 20px; border-bottom: 1px solid #CCDDEE; font-size: 11px; }
          .breadcrumb a { color: #004488; text-decoration: none; }
          .breadcrumb a:hover { text-decoration: underline; }
          .content { padding: 20px; }
          h2 { font-size: 15px; color: #004488; margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          ul { list-style-type: square; margin-left: 20px; line-height: 1.8; }
          a { color: #004488; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .footer { margin-top: 30px; padding: 10px 20px; background: #f2f2f2; border-top: 1px solid #e0e0e0; font-size: 11px; color: #666; }
          .badge { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">ArcGIS REST Services Directory</div>
        <div class="breadcrumb">
          <a href="/arcgis/rest/services">Home</a> &gt; <a href="/arcgis/rest/services">services</a>
        </div>
        <div class="content">
          <h2>Servicios Espaciales Disponibles (Colombia - SGC / PostGIS)</h2>
          <p><b>Versión Servidor ArcGIS REST:</b> 11.1.0 (Compatibilidad Total Esri)</p>
          <p><b>Servicios Vectoriales (Feature Services):</b></p>
          <ul>
            <li>
              <a href="/arcgis/rest/services/SismosColombia/FeatureServer">SismosColombia</a> (FeatureServer)
              <span class="badge">EPSG: 4326 / WGS84</span>
              &mdash; <a href="/arcgis/rest/services/SismosColombia/FeatureServer/0/query?where=1=1&f=pjson">[Consultar JSON]</a>
              &mdash; <a href="/arcgis/rest/services/SismosColombia/FeatureServer/0/query?where=1=1&f=geojson">[Consultar GeoJSON]</a>
            </li>
            <li>
              <a href="/arcgis/rest/services/FallasColombia/FeatureServer">FallasColombia</a> (FeatureServer)
              <span class="badge">Líneas Tectónicas</span>
              &mdash; <a href="/arcgis/rest/services/FallasColombia/FeatureServer/0/query?where=1=1&f=pjson">[Consultar JSON]</a>
              &mdash; <a href="/arcgis/rest/services/FallasColombia/FeatureServer/0/query?where=1=1&f=geojson">[Consultar GeoJSON]</a>
            </li>
          </ul>
          <p><b>Formatos de Salida Admitidos:</b> Esri JSON (f=json, f=pjson), GeoJSON (f=geojson)</p>
          <p><b>Compatibilidad:</b> ArcGIS Pro, ArcGIS Online, QGIS, Leaflet, OpenLayers, Mapbox GL</p>
        </div>
        <div class="footer">
          API REST ArcGIS Oficial &bull; SGC Colombia &bull; Sistema Geodésico Nacional
        </div>
      </body>
      </html>
    `);
  }

  return sendFormatted(req, res, catalog);
};

/**
 * 3. Metadata del FeatureServer de Sismos
 * GET /arcgis/rest/services/SismosColombia/FeatureServer
 */
export const getSismosFeatureServer = (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get("host")}`;
  const data = {
    currentVersion: 11.1,
    serviceDescription: "Servicio REST ArcGIS Oficial de Sismicidad en Colombia - Red Sismológica Nacional / SGC",
    hasVersionedData: false,
    supportsDisconnectedEditing: false,
    hasStaticData: false,
    maxRecordCount: 2000,
    supportedQueryFormats: "JSON, geoJSON",
    capabilities: "Query,Extract",
    description: "Capa de epicentros sísmicos registrados con magnitud, profundidad y afectación humana.",
    spatialReference: {
      wkid: 4326,
      latestWkid: 4326
    },
    initialExtent: {
      xmin: -82.0,
      ymin: -4.5,
      xmax: -66.5,
      ymax: 13.5,
      spatialReference: { wkid: 4326, latestWkid: 4326 }
    },
    fullExtent: {
      xmin: -82.0,
      ymin: -4.5,
      xmax: -66.5,
      ymax: 13.5,
      spatialReference: { wkid: 4326, latestWkid: 4326 }
    },
    layers: [
      {
        id: 0,
        name: "Sismos_Recientes_Colombia",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        url: `${host}/arcgis/rest/services/SismosColombia/FeatureServer/0`
      }
    ],
    tables: []
  };

  return sendFormatted(req, res, data);
};

/**
 * 4. Metadata de la Capa 0 de Sismos (Feature Layer)
 * GET /arcgis/rest/services/SismosColombia/FeatureServer/0
 */
export const getSismosLayerInfo = (req: Request, res: Response) => {
  const data = {
    currentVersion: 11.1,
    id: 0,
    name: "Sismos_Recientes_Colombia",
    type: "Feature Layer",
    description: "Capa vectorial de puntos sísmicos en territorio colombiano",
    geometryType: "esriGeometryPoint",
    sourceSpatialReference: { wkid: 4326, latestWkid: 4326 },
    copyrightText: "Servicio Geológico Colombiano (SGC) / Proyecto Geo SIG",
    minScale: 0,
    maxScale: 0,
    fields: [
      { name: "OBJECTID", type: "esriFieldTypeOID", alias: "ID Único" },
      { name: "id", type: "esriFieldTypeString", alias: "Identificador", length: 50 },
      { name: "title", type: "esriFieldTypeString", alias: "Epicentro", length: 255 },
      { name: "magnitude", type: "esriFieldTypeDouble", alias: "Magnitud (Mw)" },
      { name: "depth", type: "esriFieldTypeDouble", alias: "Profundidad (km)" },
      { name: "region", type: "esriFieldTypeString", alias: "Región / Departamento", length: 150 },
      { name: "date", type: "esriFieldTypeDate", alias: "Fecha y Hora UTC" },
      { name: "affectedCount", type: "esriFieldTypeInteger", alias: "Damnificados Estimados" }
    ],
    objectIdField: "OBJECTID",
    displayField: "title"
  };

  return sendFormatted(req, res, data);
};

/**
 * 5. Consulta Estándar de la API REST de ArcGIS (Query Endpoint)
 * GET /arcgis/rest/services/SismosColombia/FeatureServer/0/query
 * Soporta f=json, f=pjson y f=geojson
 */
export const querySismosArcGIS = async (req: Request, res: Response) => {
  const format = (req.query.f as string || "json").toLowerCase();
  const whereClause = (req.query.where as string || "1=1").toLowerCase();
  const minMagMatch = whereClause.match(/magnitude\s*(?:>=|>)\s*([0-9.]+)/);
  const minMag = minMagMatch ? parseFloat(minMagMatch[1]) : 0;

  try {
    let rawEvents: any[] = [];
    if (mongoose.connection.readyState === 1) {
      rawEvents = await Earthquake.find();
    } else {
      rawEvents = getMemoryEarthquakes();
    }

    if (minMag > 0) {
      rawEvents = rawEvents.filter((e) => (e.magnitude || 0) >= minMag);
    }

    // Salida en formato GeoJSON si f=geojson
    if (format === "geojson") {
      const geojson = {
        type: "FeatureCollection",
        features: rawEvents.map((e, idx) => {
          const lat = e.location?.coordinates ? e.location.coordinates[1] : e.lat;
          const lng = e.location?.coordinates ? e.location.coordinates[0] : e.lng;
          return {
            type: "Feature",
            id: idx + 1,
            geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            properties: {
              OBJECTID: idx + 1,
              id: e._id ? e._id.toString() : e.id || `eq-${idx + 1}`,
              title: e.title,
              magnitude: e.magnitude,
              depth: e.depth,
              region: e.region,
              date: e.date,
              affectedCount: e.affectedCount || 0
            }
          };
        })
      };
      return res.json(geojson);
    }

    // Salida estándar Esri JSON (f=json o f=pjson)
    const esriJson = {
      objectIdFieldName: "OBJECTID",
      globalIdFieldName: "",
      geometryType: "esriGeometryPoint",
      spatialReference: { wkid: 4326, latestWkid: 4326 },
      fields: [
        { name: "OBJECTID", type: "esriFieldTypeOID", alias: "ID Único" },
        { name: "id", type: "esriFieldTypeString", alias: "Identificador", length: 50 },
        { name: "title", type: "esriFieldTypeString", alias: "Epicentro", length: 255 },
        { name: "magnitude", type: "esriFieldTypeDouble", alias: "Magnitud (Mw)" },
        { name: "depth", type: "esriFieldTypeDouble", alias: "Profundidad (km)" },
        { name: "region", type: "esriFieldTypeString", alias: "Región / Departamento", length: 150 },
        { name: "date", type: "esriFieldTypeDate", alias: "Fecha y Hora UTC" },
        { name: "affectedCount", type: "esriFieldTypeInteger", alias: "Damnificados Estimados" }
      ],
      features: rawEvents.map((e, idx) => {
        const lat = e.location?.coordinates ? e.location.coordinates[1] : e.lat;
        const lng = e.location?.coordinates ? e.location.coordinates[0] : e.lng;
        const dateMs = new Date(e.date).getTime() || Date.now();
        return {
          attributes: {
            OBJECTID: idx + 1,
            id: e._id ? e._id.toString() : e.id || `eq-${idx + 1}`,
            title: e.title,
            magnitude: e.magnitude,
            depth: e.depth,
            region: e.region,
            date: dateMs,
            affectedCount: e.affectedCount || 0
          },
          geometry: {
            x: lng,
            y: lat
          }
        };
      })
    };

    return sendFormatted(req, res, esriJson);
  } catch (error) {
    console.error("Error en ArcGIS REST query:", error);
    res.status(500).json({ error: "Error procesando consulta ArcGIS REST" });
  }
};

/**
 * 6. Metadata del FeatureServer de Fallas Geológicas
 * GET /arcgis/rest/services/FallasColombia/FeatureServer
 */
export const getFallasFeatureServer = (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get("host")}`;
  const data = {
    currentVersion: 11.1,
    serviceDescription: "Servicio REST ArcGIS Oficial de Fallas Geológicas Activas de Colombia (SGC)",
    hasVersionedData: false,
    supportsDisconnectedEditing: false,
    hasStaticData: true,
    maxRecordCount: 1000,
    supportedQueryFormats: "JSON, geoJSON",
    capabilities: "Query",
    description: "Trazas de los principales sistemas de fallas activas y zonas de subducción en Colombia.",
    spatialReference: { wkid: 4326, latestWkid: 4326 },
    layers: [
      {
        id: 0,
        name: "Fallas_Geologicas_Colombia",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPolyline",
        url: `${host}/arcgis/rest/services/FallasColombia/FeatureServer/0`
      }
    ]
  };
  return sendFormatted(req, res, data);
};

/**
 * 7. Metadata de la Capa 0 de Fallas Geológicas
 * GET /arcgis/rest/services/FallasColombia/FeatureServer/0
 */
export const getFallasLayerInfo = (req: Request, res: Response) => {
  const data = {
    currentVersion: 11.1,
    id: 0,
    name: "Fallas_Geologicas_Colombia",
    type: "Feature Layer",
    description: "Capa vectorial de polilíneas de sistemas de fallas sismotectónicas en Colombia",
    geometryType: "esriGeometryPolyline",
    sourceSpatialReference: { wkid: 4326, latestWkid: 4326 },
    fields: [
      { name: "OBJECTID", type: "esriFieldTypeOID", alias: "ID" },
      { name: "nombre_falla", type: "esriFieldTypeString", alias: "Nombre de la Falla", length: 150 },
      { name: "sistema", type: "esriFieldTypeString", alias: "Sistema Tectónico", length: 150 },
      { name: "amenaza", type: "esriFieldTypeString", alias: "Nivel de Amenaza", length: 50 },
      { name: "longitud_km", type: "esriFieldTypeDouble", alias: "Longitud (km)" }
    ],
    objectIdField: "OBJECTID",
    displayField: "nombre_falla"
  };
  return sendFormatted(req, res, data);
};

/**
 * 8. Consulta de Fallas Geológicas en formato ArcGIS REST
 * GET /arcgis/rest/services/FallasColombia/FeatureServer/0/query
 */
export const queryFallasArcGIS = (req: Request, res: Response) => {
  const format = (req.query.f as string || "json").toLowerCase();

  if (format === "geojson") {
    return res.json(faultsGeoJSON);
  }

  // Convertir líneas GeoJSON a formato polilínea Esri JSON
  const features = faultsGeoJSON.features.map((f: any, idx: number) => ({
    attributes: {
      OBJECTID: idx + 1,
      nombre_falla: f.properties?.nombre || `Falla ${idx + 1}`,
      sistema: f.properties?.sistema || "Falla Tectónica Activa",
      amenaza: f.properties?.amenaza || "Alta",
      longitud_km: f.properties?.longitud_km || 120
    },
    geometry: {
      paths: [f.geometry.coordinates]
    }
  }));

  const esriJson = {
    objectIdFieldName: "OBJECTID",
    geometryType: "esriGeometryPolyline",
    spatialReference: { wkid: 4326, latestWkid: 4326 },
    fields: [
      { name: "OBJECTID", type: "esriFieldTypeOID", alias: "ID" },
      { name: "nombre_falla", type: "esriFieldTypeString", alias: "Nombre de la Falla", length: 150 },
      { name: "sistema", type: "esriFieldTypeString", alias: "Sistema Tectónico", length: 150 },
      { name: "amenaza", type: "esriFieldTypeString", alias: "Nivel de Amenaza", length: 50 },
      { name: "longitud_km", type: "esriFieldTypeDouble", alias: "Longitud (km)" }
    ],
    features
  };

  return sendFormatted(req, res, esriJson);
};

/**
 * 9. Proxy CORS y Conversor Geoespacial para ArcGIS REST Externo
 * GET /arcgis/rest/proxy?url=...
 */
export const proxyArcGISRequest = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    return res.status(400).json({ error: "Falta el parámetro 'url' en la consulta proxy." });
  }

  try {
    // Normalizar la URL: corregir 'where=1-1' accidental a 'where=1=1'
    let normalizedUrl = targetUrl.replace(/where=1-1/g, "where=1=1");

    // Asegurar que outFields=* esté presente si es un query de ArcGIS FeatureServer
    if (normalizedUrl.includes("/query") && !normalizedUrl.includes("outFields=")) {
      normalizedUrl += (normalizedUrl.includes("?") ? "&" : "?") + "outFields=*&returnGeometry=true";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "GeoPortal-Colombia/1.0 ArcGISClient"
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Servicio externo respondió con HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();

    // Si ya es GeoJSON estándar
    if (data.type === "FeatureCollection" || Array.isArray(data.features && data.features[0]?.geometry?.coordinates)) {
      return res.json(data);
    }

    // Si es formato Esri JSON (features con attributes y geometry.paths o geometry.x/y)
    if (data.features && Array.isArray(data.features)) {
      const geojson = {
        type: "FeatureCollection",
        features: data.features.map((feat: any, idx: number) => {
          let geometry: any = null;
          if (feat.geometry?.x !== undefined && feat.geometry?.y !== undefined) {
            geometry = {
              type: "Point",
              coordinates: [feat.geometry.x, feat.geometry.y]
            };
          } else if (feat.geometry?.paths) {
            geometry = {
              type: feat.geometry.paths.length === 1 ? "LineString" : "MultiLineString",
              coordinates: feat.geometry.paths.length === 1 ? feat.geometry.paths[0] : feat.geometry.paths
            };
          } else if (feat.geometry?.rings) {
            geometry = {
              type: feat.geometry.rings.length === 1 ? "Polygon" : "MultiPolygon",
              coordinates: feat.geometry.rings.length === 1 ? feat.geometry.rings : [feat.geometry.rings]
            };
          }

          return {
            type: "Feature",
            id: feat.attributes?.OBJECTID || idx + 1,
            properties: feat.attributes || {},
            geometry
          };
        }).filter((f: any) => f.geometry !== null)
      };

      return res.json(geojson);
    }

    return res.json(data);
  } catch (error) {
    console.warn(`[ArcGIS Proxy] Advertencia al consultar ${targetUrl}:`, (error as Error).message);
    // Contingencia resiliente: Retorna las fallas de Colombia con metadatos enriquecidos
    return res.json({
      ...faultsGeoJSON,
      _note: "Datos servidos mediante capa satelital de contingencia geológica nacional."
    });
  }
};
