// ==========================================================
// ETAPAS DE LA TRAZABILIDAD Y SU PORCENTAJE DE AVANCE
// ----------------------------------------------------------
// El recorrido de un lote de cacao fino de aroma se divide
// en 5 etapas, en este orden. Cada etapa tiene las
// actividades que se esperan en ella y cada actividad vale
// lo mismo dentro de su etapa:
//
//   1. Producción en finca (4 actividades → 25 % cada una)
//      Siembra o renovación, Riego, Fertilización y Control
//      fitosanitario (la fumigación cuenta como control
//      fitosanitario).
//   2. Cosecha y beneficio (3 actividades → 33 % cada una)
//      Cosecha, Procesamiento (fermentación y secado) y
//      Control de calidad.
//   3. Almacenamiento (1 actividad → 100 %)
//   4. Transporte     (1 actividad → 100 %)
//   5. Distribución   (1 actividad → 100 %)
//
// Una actividad registrada varias veces cuenta una sola vez.
// «Certificación» y «Otro» se muestran en el historial pero
// no suman al avance (la certificación tiene su propio
// proceso en el módulo de Certificaciones).
//
// El avance TOTAL es el promedio de las 5 etapas: cada etapa
// pesa lo mismo (20 %).
// ==========================================================

export const ETAPAS_TRAZABILIDAD = [
  {
    clave: "produccion",
    nombre: "Producción en finca",
    color: "#2a78d6",
    actividades: [
      { nombre: "Siembra o renovación", tipos: ["siembra"] },
      { nombre: "Riego", tipos: ["riego"] },
      { nombre: "Fertilización", tipos: ["fertilizacion"] },
      { nombre: "Control fitosanitario", tipos: ["control_fitosanitario", "fumigacion"] }
    ]
  },
  {
    clave: "cosecha",
    nombre: "Cosecha y beneficio",
    color: "#eb6834",
    actividades: [
      { nombre: "Cosecha", tipos: ["cosecha"] },
      { nombre: "Fermentación y secado", tipos: ["procesamiento"] },
      { nombre: "Control de calidad", tipos: ["control_calidad"] }
    ]
  },
  {
    clave: "almacenamiento",
    nombre: "Almacenamiento",
    color: "#1baf7a",
    actividades: [
      { nombre: "Almacenamiento", tipos: ["almacenamiento"] }
    ]
  },
  {
    clave: "transporte",
    nombre: "Transporte",
    color: "#eda100",
    actividades: [
      { nombre: "Transporte", tipos: ["transporte"] }
    ]
  },
  {
    clave: "distribucion",
    nombre: "Distribución",
    color: "#e87ba4",
    actividades: [
      { nombre: "Distribución", tipos: ["distribucion"] }
    ]
  }
];


// Calcula el avance de cada etapa y el total a partir de
// las actividades registradas del lote.
export const calcularAvance = (eventos = []) => {
  const registrados = new Set(eventos.map((e) => e.tipo));

  const etapas = ETAPAS_TRAZABILIDAD.map((etapa) => {
    const actividades = etapa.actividades.map((a) => ({
      nombre: a.nombre,
      hecha: a.tipos.some((t) => registrados.has(t))
    }));
    const hechas = actividades.filter((a) => a.hecha).length;
    const porcentaje = Math.round((hechas / actividades.length) * 100);

    return {
      clave: etapa.clave,
      nombre: etapa.nombre,
      color: etapa.color,
      actividades,
      hechas,
      total: actividades.length,
      porcentaje,
      // fraccion sin redondear, para el total
      fraccion: hechas / actividades.length
    };
  });

  const total = Math.round(
    (etapas.reduce((suma, e) => suma + e.fraccion, 0) / etapas.length) * 100
  );

  // Etapa actual: la primera, en orden, que no está completa.
  const indiceActual = etapas.findIndex((e) => e.porcentaje < 100);

  etapas.forEach((e, i) => {
    if (e.porcentaje === 100) {
      e.situacion = "completa";
    } else if (i === indiceActual) {
      e.situacion = e.hechas > 0 ? "en_curso" : "siguiente";
    } else {
      e.situacion = e.hechas > 0 ? "incompleta" : "pendiente";
    }
  });

  // Etapas posteriores con actividades mientras una anterior
  // sigue incompleta: se avisa, porque rompe el orden lógico.
  const saltos = indiceActual === -1
    ? []
    : etapas.slice(indiceActual + 1).filter((e) => e.hechas > 0).map((e) => e.nombre);

  return {
    etapas,
    total,
    etapaActual: indiceActual === -1 ? null : etapas[indiceActual].nombre,
    saltos
  };
};
