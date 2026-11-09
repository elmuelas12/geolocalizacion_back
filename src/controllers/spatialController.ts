import { Request, Response } from "express";
import { pgPool, isPostgresConnected } from "../config/postgres";

// Sistema de Caché en Memoria RAM (Ultra-rápido, 5 min TTL) para consultas PostGIS pesadas
const spatialCache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL = 5 * 60 * 1000;

function getFromCache(key: string) {
  const cached = spatialCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.payload;
  }
  return null;
}

function saveToCache(key: string, payload: any) {
  spatialCache.set(key, { timestamp: Date.now(), payload });
}

/**
 * CONTROLADOR ESPACIAL - POSTGIS (EPSG 9377 - ORIGEN ÚNICO NACIONAL)
 * Implementación de 11 Consultas Espaciales asociadas a las capas geográficas
 */

// 1. Sismos dentro de Municipios (ST_Within en EPSG 9377)
export const getSismosEnMunicipios = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        m.nombre AS municipio,
        m.departamento,
        COUNT(s.id) AS total_sismos,
        json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Transform(s.geom, 4326))::json,
              'properties', json_build_object('title', s.title, 'magnitude', s.magnitude, 'region', s.region)
            )
          ), '[]'::json)
        ) AS geojson
      FROM public.municipios_colombia m
      LEFT JOIN public.sismos_espacial s 
        ON ST_Within(s.geom, m.geom)
      GROUP BY m.id, m.nombre, m.departamento;
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 1: Sismos dentro de Municipios", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 2. Buffer de Área de Impacto Sísmico (ST_Buffer en EPSG 9377)
export const getBufferImpactoSismo = async (req: Request, res: Response) => {
  try {
    const radioMetros = parseInt(req.query.radio as string) || 30000; // 30 km por defecto
    const query = `
      SELECT 
        s.id,
        s.title,
        s.magnitude,
        ${radioMetros} AS radio_afectacion_metros,
        ST_AsGeoJSON(ST_Transform(ST_Buffer(s.geom, $1), 4326))::json AS buffer_geojson
      FROM public.sismos_espacial s;
    `;
    const result = await pgPool.query(query, [radioMetros]);
    res.json({ title: `Consulta 2: Área de Impacto Sísmico (Buffer ${radioMetros/1000} km)`, data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 3. Distancia desde Reportes hasta Epicentros (ST_Distance en EPSG 9377)
export const getDistanciaReportesEpicentro = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        r.reporter_name,
        r.location_name,
        s.title AS sismo_asociado,
        ROUND((ST_Distance(r.geom, s.geom) / 1000)::numeric, 2) AS distancia_km
      FROM public.reportes_espacial r
      CROSS JOIN LATERAL (
        SELECT title, geom 
        FROM public.sismos_espacial 
        ORDER BY r.geom <-> geom 
        LIMIT 1
      ) s;
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 3: Distancia exacta desde Reportes al Epicentro más Cercano", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 4. Conteo y Agrupación de Emergencias por Municipio (ST_Contains)
export const getConteoEmergenciasPorMunicipio = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        m.nombre AS municipio,
        m.departamento,
        COUNT(r.id) AS total_reportes,
        COALESCE(SUM(r.affected_people), 0) AS total_personas_afectadas
      FROM public.municipios_colombia m
      LEFT JOIN public.reportes_espacial r 
        ON ST_Contains(m.geom, r.geom)
      GROUP BY m.id, m.nombre, m.departamento
      ORDER BY total_reportes DESC;
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 4: Conteo de Emergencias y Afectados por Municipio", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 5. Cálculo de Área Total de Zonas de Riesgo (ST_Area en EPSG 9377 en m² y km²)
export const getAreaZonasRiesgo = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        nombre_zona,
        nivel_amenaza,
        ROUND((ST_Area(geom) / 1000000)::numeric, 2) AS area_calculada_km2,
        ROUND((ST_Area(geom))::numeric, 2) AS area_calculada_m2
      FROM public.zonas_riesgo
      ORDER BY area_calculada_km2 DESC;
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 5: Área Geográfica de Zonas de Riesgo Sísmico (EPSG 9377)", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 6. Intersección entre Zonas de Riesgo y Municipios (ST_Intersects & ST_Intersection)
export const getInterseccionRiesgoMunicipios = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        m.nombre AS municipio,
        z.nombre_zona,
        z.nivel_amenaza,
        ROUND((ST_Area(ST_Intersection(m.geom, z.geom)) / 1000000)::numeric, 2) AS area_interseccion_km2,
        ST_AsGeoJSON(ST_Transform(ST_Intersection(m.geom, z.geom), 4326))::json AS geojson_interseccion
      FROM public.municipios_colombia m
      JOIN public.zonas_riesgo z 
        ON ST_Intersects(m.geom, z.geom);
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 6: Intersección Espacial Zonas de Riesgo vs Municipios", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 7. Centroide Geométrico de Zonas de Amenaza (ST_Centroid)
export const getCentroidesZonasRiesgo = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        nombre_zona,
        nivel_amenaza,
        ST_AsGeoJSON(ST_Transform(ST_Centroid(geom), 4326))::json AS centroide_geojson
      FROM public.zonas_riesgo;
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 7: Centroide Geográfico de Zonas de Amenaza Sísmica", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 8. Sismos de Alta Magnitud en Zonas de Amenaza Crítica
export const getSismosAltaMagnitudEnRiesgo = async (req: Request, res: Response) => {
  try {
    const minMag = parseFloat(req.query.minMag as string) || 5.5;
    const query = `
      SELECT 
        s.title,
        s.magnitude,
        s.depth,
        z.nombre_zona,
        z.nivel_amenaza
      FROM public.sismos_espacial s
      JOIN public.zonas_riesgo z 
        ON ST_Intersects(s.geom, z.geom)
      WHERE s.magnitude >= $1;
    `;
    const result = await pgPool.query(query, [minMag]);
    res.json({ title: `Consulta 8: Sismos Magnitud >= ${minMag} en Zonas de Amenaza`, data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 9. Evaluación de Población Expuesta a Amenaza Sísmica
export const getPoblacionEnRiesgo = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        m.nombre AS municipio,
        m.poblacion AS poblacion_total,
        z.nivel_amenaza,
        ROUND((m.poblacion * (ST_Area(ST_Intersection(m.geom, z.geom)) / ST_Area(m.geom)))::numeric, 0) AS poblacion_estimada_expuesta
      FROM public.municipios_colombia m
      JOIN public.zonas_riesgo z 
        ON ST_Intersects(m.geom, z.geom);
    `;
    const result = await pgPool.query(query);
    res.json({ title: "Consulta 9: Estimación de Población Expuesta a Riesgo Sísmico", data: result.rows });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 10. Renderizado GeoJSON de Capas Vectoriales (ST_Transform 9377 a 4326)
export const getGeoJSONCapas = async (req: Request, res: Response) => {
  try {
    const capa = (req.query.capa as string) || "municipios";
    let tabla = "municipios_colombia";
    if (capa === "zonas_riesgo") tabla = "zonas_riesgo";
    if (capa === "sismos") tabla = "sismos_espacial";
    if (capa === "reportes") tabla = "reportes_espacial";

    const query = `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::json,
            'properties', to_jsonb(t.*) - 'geom'
          )
        ), '[]'::json)
      ) AS geojson
      FROM public.${tabla} t;
    `;
    const result = await pgPool.query(query);
    res.json({ title: `Consulta 10: Capa GeoJSON [${capa}] (EPSG 9377 -> 4326)`, data: result.rows[0].geojson });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// 11. Teselado Espacial Regular y Voronoi (ST_HexagonGrid, ST_SquareGrid, ST_VoronoiPolygons en EPSG 9377)
export const getTeseladoEspacial = async (req: Request, res: Response) => {
  try {
    const tipo = (req.query.tipo as string) || "hexagonal"; // "hexagonal" | "cuadricula" | "voronoi"
    const radioMetros = parseInt(req.query.size as string) || 50000; // 50 km por defecto
    const capa = (req.query.capa as string) || "sismos"; // "sismos" | "reportes"
    const onlyWithEvents = req.query.onlyWithEvents !== "false"; // filtrar celdas con eventos

    // Verificación en Caché RAM ultra-rápida (1-2 ms)
    const cacheKey = `tess_${tipo}_${radioMetros}_${capa}_${onlyWithEvents}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const tablaEventos = capa === "reportes" ? "public.reportes_espacial" : "public.sismos_espacial";

    let query = "";
    if (tipo === "voronoi") {
      query = `
        WITH coleccion AS (
          SELECT ST_Collect(geom) AS geom_coleccion FROM ${tablaEventos}
        ),
        bounding_box AS (
          SELECT COALESCE(
            (SELECT ST_SetSRID(ST_Extent(geom), 9377) FROM public.municipios_colombia),
            (SELECT ST_SetSRID(ST_Extent(geom), 9377) FROM ${tablaEventos}),
            ST_MakeEnvelope(4000000, 1500000, 5500000, 3200000, 9377)
          ) AS bbox
        ),
        poligonos_voronoi AS (
          SELECT (ST_Dump(ST_VoronoiPolygons(c.geom_coleccion, 0.0, b.bbox))).geom AS geom
          FROM coleccion c, bounding_box b
        ),
        voronoi_stats AS (
          SELECT 
            row_number() OVER () AS cell_id,
            v.geom,
            COUNT(s.id) AS total_eventos,
            ${capa === "sismos" 
              ? "ROUND(COALESCE(AVG(s.magnitude), 0)::numeric, 2) AS magnitud_promedio, ROUND(COALESCE(MAX(s.magnitude), 0)::numeric, 2) AS magnitud_maxima, ROUND(COALESCE(AVG(s.depth), 0)::numeric, 1) AS profundidad_promedio," 
              : "ROUND(COALESCE(SUM(s.affected_people), 0)::numeric, 0) AS total_afectados,"}
            ROUND((ST_Area(v.geom) / 1000000)::numeric, 2) AS area_km2
          FROM poligonos_voronoi v
          LEFT JOIN ${tablaEventos} s ON ST_Intersects(v.geom, s.geom)
          GROUP BY v.geom
        )
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Transform(vs.geom, 4326))::json,
              'properties', json_build_object(
                'cell_id', concat('VOR-', vs.cell_id),
                'tipo_malla', 'Teselado Voronoi (Polígonos de Thiessen)',
                'total_eventos', vs.total_eventos,
                ${capa === "sismos" ? "'magnitud_promedio', vs.magnitud_promedio, 'magnitud_maxima', vs.magnitud_maxima, 'profundidad_promedio', vs.profundidad_promedio," : "'total_afectados', vs.total_afectados,"}
                'area_km2', vs.area_km2,
                'densidad', CASE 
                  WHEN vs.total_eventos >= 5 THEN 'Muy Alta'
                  WHEN vs.total_eventos >= 3 THEN 'Alta'
                  WHEN vs.total_eventos >= 1 THEN 'Media'
                  ELSE 'Baja'
                END
              )
            )
          ), '[]'::json) AS geojson,
          COALESCE(json_agg(
            json_build_object(
              'celda', concat('VOR-', vs.cell_id),
              'total_eventos', vs.total_eventos,
              ${capa === "sismos" ? "'magnitud_promedio', vs.magnitud_promedio, 'magnitud_maxima', vs.magnitud_maxima," : "'total_afectados', vs.total_afectados,"}
              'area_km2', vs.area_km2
            )
          ), '[]'::json) AS stats
        FROM voronoi_stats vs;
      `;
    } else {
      const gridFunction = tipo === "cuadricula" ? "ST_SquareGrid" : "ST_HexagonGrid";
      query = `
        WITH bounding_box AS (
          SELECT COALESCE(
            (SELECT ST_SetSRID(ST_Extent(geom), 9377) FROM public.municipios_colombia),
            (SELECT ST_SetSRID(ST_Extent(geom), 9377) FROM ${tablaEventos}),
            ST_MakeEnvelope(4000000, 1500000, 5500000, 3200000, 9377)
          ) AS bbox
        ),
        grid AS (
          SELECT g.geom, g.i, g.j 
          FROM bounding_box b,
          LATERAL ${gridFunction}($1, b.bbox) g
        ),
        cell_stats AS (
          SELECT 
            g.i,
            g.j,
            g.geom,
            COUNT(s.id) AS total_eventos,
            ${capa === "sismos" 
              ? "ROUND(COALESCE(AVG(s.magnitude), 0)::numeric, 2) AS magnitud_promedio, ROUND(COALESCE(MAX(s.magnitude), 0)::numeric, 2) AS magnitud_maxima, ROUND(COALESCE(AVG(s.depth), 0)::numeric, 1) AS profundidad_promedio," 
              : "ROUND(COALESCE(SUM(s.affected_people), 0)::numeric, 0) AS total_afectados,"}
            ROUND((ST_Area(g.geom) / 1000000)::numeric, 2) AS area_km2
          FROM grid g
          ${onlyWithEvents ? "JOIN" : "LEFT JOIN"} ${tablaEventos} s 
            ON ST_Intersects(g.geom, s.geom)
          GROUP BY g.i, g.j, g.geom
          ${onlyWithEvents ? "HAVING COUNT(s.id) > 0" : ""}
        )
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Transform(cs.geom, 4326))::json,
              'properties', json_build_object(
                'cell_id', concat('${tipo === "cuadricula" ? "GRID" : "HEX"}-', cs.i, '-', cs.j),
                'i', cs.i,
                'j', cs.j,
                'tipo_malla', '${tipo === "cuadricula" ? "Cuadrícula Regular (ST_SquareGrid)" : "Hexagonal (ST_HexagonGrid)"}',
                'total_eventos', cs.total_eventos,
                ${capa === "sismos" ? "'magnitud_promedio', cs.magnitud_promedio, 'magnitud_maxima', cs.magnitud_maxima, 'profundidad_promedio', cs.profundidad_promedio," : "'total_afectados', cs.total_afectados,"}
                'area_km2', cs.area_km2,
                'densidad', CASE 
                  WHEN cs.total_eventos >= 8 THEN 'Muy Alta'
                  WHEN cs.total_eventos >= 4 THEN 'Alta'
                  WHEN cs.total_eventos >= 2 THEN 'Media'
                  WHEN cs.total_eventos = 1 THEN 'Baja'
                  ELSE 'Sin Eventos'
                END
              )
            )
          ), '[]'::json) AS geojson,
          COALESCE(json_agg(
            json_build_object(
              'celda', concat('${tipo === "cuadricula" ? "GRID" : "HEX"}-', cs.i, '-', cs.j),
              'total_eventos', cs.total_eventos,
              ${capa === "sismos" ? "'magnitud_promedio', cs.magnitud_promedio, 'magnitud_maxima', cs.magnitud_maxima," : "'total_afectados', cs.total_afectados,"}
              'area_km2', cs.area_km2
            )
          ), '[]'::json) AS stats
        FROM cell_stats cs;
      `;
    }

    const params = tipo === "voronoi" ? [] : [radioMetros];
    const result = await pgPool.query(query, params);

    const geojson = result.rows[0]?.geojson || { type: "FeatureCollection", features: [] };
    const stats = result.rows[0]?.stats || [];

    const responsePayload = {
      title: `Consulta 11: Teselado Espacial ${tipo === "cuadricula" ? "Cuadrangular (ST_SquareGrid)" : tipo === "voronoi" ? "Voronoi (ST_VoronoiPolygons)" : "Hexagonal (ST_HexagonGrid)"} (${radioMetros / 1000} km)`,
      tipo,
      radioKm: radioMetros / 1000,
      totalCeldas: geojson.features?.length || 0,
      data: stats,
      geojson
    };

    saveToCache(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
