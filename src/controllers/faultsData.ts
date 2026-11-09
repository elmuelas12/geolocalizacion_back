export const faultsGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-77.28, 0.82],
          [-77.10, 1.45],
          [-76.80, 2.15],
          [-76.60, 2.80],
          [-76.45, 3.45],
          [-76.25, 4.10],
          [-75.80, 4.80],
          [-75.60, 5.50],
          [-75.50, 6.25],
          [-75.35, 7.10],
          [-75.10, 8.20],
          [-74.90, 9.30]
        ]
      },
      properties: {
        id: "falla-romeral",
        nombre: "Sistema de Fallas de Romeral",
        sistema: "Romeral",
        tipo: "Rumbo dextral con componente inversa",
        longitud_km: 1200,
        amenaza: "Muy Alto",
        descripcion: "El sistema sismotectónico más largo e importante del occidente colombiano."
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.80, 5.80],
          [-73.40, 6.30],
          [-73.15, 6.85],
          [-73.12, 7.15],
          [-73.25, 7.90],
          [-73.45, 8.80],
          [-73.80, 9.70],
          [-74.15, 10.50],
          [-74.20, 11.20]
        ]
      },
      properties: {
        id: "falla-bucaramanga",
        nombre: "Falla de Bucaramanga - Santa Marta",
        sistema: "Bucaramanga - Santa Marta",
        tipo: "Rumbo sinestral de alto ángulo",
        longitud_km: 600,
        amenaza: "Muy Alto",
        descripcion: "Estructura tectónica mayor responsable del Nido Sísmico de Bucaramanga."
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-76.10, 1.60],
          [-75.70, 2.20],
          [-75.30, 2.70],
          [-74.90, 3.30],
          [-74.40, 3.90],
          [-73.90, 4.40],
          [-73.40, 4.90]
        ]
      },
      properties: {
        id: "falla-algeciras",
        nombre: "Falla de Algeciras (Frente Oriental)",
        sistema: "Algeciras - Fosa Magdalena",
        tipo: "Transcurrente dextral e inversa",
        longitud_km: 450,
        amenaza: "Alto",
        descripcion: "Límite tectónico activo entre la Cordillera Oriental y la cuenca de los Llanos."
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.50, 1.50],
          [-78.90, 2.50],
          [-78.40, 3.80],
          [-78.10, 5.00],
          [-77.90, 6.20],
          [-77.80, 7.50]
        ]
      },
      properties: {
        id: "fosa-pacifico",
        nombre: "Zona de Subducción de la Fosa del Pacífico",
        sistema: "Interacción Placa Nazca - Placa Suramericana",
        tipo: "Subducción de megaempuje (Megathrust)",
        longitud_km: 1300,
        amenaza: "Muy Alto",
        descripcion: "Zona de choque convergente generadora de megaterremotos y tsunamis en Tumaco y Chocó."
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-72.80, 7.20],
          [-72.50, 7.85],
          [-72.30, 8.40],
          [-72.00, 9.00],
          [-71.50, 9.60]
        ]
      },
      properties: {
        id: "falla-bocono",
        nombre: "Falla de Boconó - Frontera Colombo-Venezolana",
        sistema: "Boconó",
        tipo: "Rumbo dextral",
        longitud_km: 500,
        amenaza: "Alto",
        descripcion: "Se extiende a través de los Andes e impacta Cúcuta y Norte de Santander."
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-77.05, 1.80],
          [-76.75, 2.30],
          [-76.55, 3.10],
          [-76.40, 3.90],
          [-76.05, 4.60]
        ]
      },
      properties: {
        id: "falla-cauca-patia",
        nombre: "Sistema de Fallas Cauca - Almaguer",
        sistema: "Cauca - Patía",
        tipo: "Inversa con componente de rumbo",
        longitud_km: 380,
        amenaza: "Alto",
        descripcion: "Responsable de eventos sísmicos en Popayán, Cali y el valle del río Cauca."
      }
    }
  ]
};
