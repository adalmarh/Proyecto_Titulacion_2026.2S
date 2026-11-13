// ==========================================================
// NORMA TÉCNICA ECUATORIANA NTE INEN 176:2021
// «Granos de cacao. Requisitos» (sexta revisión)
// ----------------------------------------------------------
// Tabla 1 de la norma: requisitos de calidad de los granos de
// cacao y su clasificación en Grado 1, Grado 2 y Grado 3.
//
// El certificador registra el análisis de una muestra del
// lote (prueba de corte de 100 granos, humedad, etc.) y el
// sistema calcula el grado:
//   - Cada parámetro recibe el MEJOR grado cuyo límite cumple.
//   - El grado del lote es el PEOR de todos los parámetros
//     (un lote es Grado 1 solo si TODOS cumplen el Grado 1).
//   - Si algún parámetro no cumple ni el Grado 3, o el grano
//     tiene olor a humo o está infestado, el lote NO CUMPLE
//     la norma y no se puede aprobar.
//
// El frontend tiene una copia de esta tabla para mostrar el
// grado mientras se escribe (frontend/src/utils/normaInen176.js);
// la que manda es ESTA: el backend vuelve a calcular el grado
// al aprobar.
// ==========================================================

const NORMA = {
  codigo: "NTE INEN 176:2021",
  titulo: "Granos de cacao. Requisitos",
  revision: "Sexta revisión",
  entidad: "Servicio Ecuatoriano de Normalización (INEN)"
};

// tipo "max": el valor no puede superar el límite
// tipo "min": el valor no puede ser menor que el límite
// tipo "peso": peso de 100 granos (G1 > 130 g; G2 > 120 a 130 g;
//              G3 100 a 120 g)
const PARAMETROS = [
  { clave: "humedad", nombre: "Humedad", unidad: "%", tipo: "max", limites: [7, 7, 7], metodo: "NTE INEN-ISO 2291" },
  { clave: "peso100Granos", nombre: "Peso de 100 granos", unidad: "g", tipo: "peso", limites: [130, 120, 100], metodo: "Balanza" },
  { clave: "bienFermentados", nombre: "Granos bien fermentados", unidad: "%", tipo: "min", limites: [75, 65, 53], metodo: "NTE INEN-ISO 1114 (prueba de corte)" },
  { clave: "violetas", nombre: "Granos violetas", unidad: "%", tipo: "max", limites: [15, 21, 25], metodo: "NTE INEN-ISO 1114 (prueba de corte)" },
  { clave: "pizarrosos", nombre: "Granos pizarrosos", unidad: "%", tipo: "max", limites: [9, 12, 18], metodo: "NTE INEN-ISO 1114 (prueba de corte)" },
  { clave: "mohosos", nombre: "Granos mohosos", unidad: "%", tipo: "max", limites: [1, 2, 4], metodo: "NTE INEN-ISO 1114 (prueba de corte)" },
  { clave: "defectuosos", nombre: "Granos defectuosos", unidad: "%", tipo: "max", limites: [0.5, 1, 3], metodo: "Anexo C de la norma" },
  { clave: "materialRelacionado", nombre: "Material relacionado con el cacao", unidad: "%", tipo: "max", limites: [1, 1, 1], metodo: "Anexo C de la norma" },
  { clave: "materiaExtrana", nombre: "Materia extraña", unidad: "%", tipo: "max", limites: [0.75, 0.75, 0.75], metodo: "Anexo C de la norma" }
];

// Requisitos generales de la sección 5 (sí / no)
const REQUISITOS_GENERALES = [
  { clave: "sinHumo", nombre: "Sin olor ni sabor a humo ni señales de contaminación por humo" },
  { clave: "sinInfestacion", nombre: "Granos libres de infestación (insectos vivos)" }
];

class ErrorAnalisis extends Error {}


// Texto del límite de un parámetro para un grado (0, 1 o 2)
const textoLimite = (p, i) => {
  const n = (v) => String(v).replace(".", ",");
  if (p.tipo === "max") return `máx. ${n(p.limites[i])} ${p.unidad}`;
  if (p.tipo === "min") return `mín. ${n(p.limites[i])} ${p.unidad}`;
  if (i === 0) return `más de 130 g`;
  if (i === 1) return `más de 120 a 130 g`;
  return `100 a 120 g`;
};


// ¿El valor cumple el grado i (0 = Grado 1)?
const cumpleGrado = (p, valor, i) => {
  if (p.tipo === "max") return valor <= p.limites[i];
  if (p.tipo === "min") return valor >= p.limites[i];
  // peso de 100 granos
  if (i === 0) return valor > 130;
  if (i === 1) return valor > 120;
  return valor >= 100;
};


// Valida los números del análisis y calcula el grado.
// Devuelve { norma, parametros, generales, grado, cumple, motivos }
const evaluarAnalisis = (entrada) => {
  if (!entrada || typeof entrada !== "object") {
    throw new ErrorAnalisis("Falta el análisis de calidad según la NTE INEN 176");
  }

  const parametros = PARAMETROS.map((p) => {
    const bruto = entrada[p.clave];
    const valor = Number(String(bruto ?? "").replace(",", "."));

    if (bruto === "" || bruto === null || bruto === undefined || !Number.isFinite(valor) || valor < 0) {
      throw new ErrorAnalisis(`Indica un valor válido para «${p.nombre}»`);
    }
    if (p.unidad === "%" && valor > 100) {
      throw new ErrorAnalisis(`«${p.nombre}» no puede ser mayor que 100 %`);
    }

    const indice = [0, 1, 2].find((i) => cumpleGrado(p, valor, i));
    return {
      clave: p.clave,
      nombre: p.nombre,
      unidad: p.unidad,
      valor,
      grado: indice === undefined ? null : indice + 1
    };
  });

  const generales = REQUISITOS_GENERALES.map((r) => ({
    clave: r.clave,
    nombre: r.nombre,
    cumple: entrada[r.clave] === true || entrada[r.clave] === "true"
  }));

  const motivos = [
    ...parametros
      .filter((p) => p.grado === null)
      .map((p) => {
        const def = PARAMETROS.find((x) => x.clave === p.clave);
        return `${p.nombre}: ${String(p.valor).replace(".", ",")} ${p.unidad} (Grado 3 exige ${textoLimite(def, 2)})`;
      }),
    ...generales.filter((g) => !g.cumple).map((g) => `No cumple: ${g.nombre.toLowerCase()}`)
  ];

  const cumple = motivos.length === 0;
  const grado = cumple ? Math.max(...parametros.map((p) => p.grado)) : null;

  return {
    norma: NORMA.codigo,
    parametros,
    generales,
    grado,
    cumple,
    motivos
  };
};


// Lo que se guarda en la certificación
const analisisParaGuardar = (entrada, resultado) => {
  const guardado = { norma: NORMA.codigo, grado: resultado.grado, fechaAnalisis: new Date() };
  resultado.parametros.forEach((p) => { guardado[p.clave] = p.valor; });
  resultado.generales.forEach((g) => { guardado[g.clave] = g.cumple; });
  if (entrada.fechaMuestra) {
    const f = new Date(entrada.fechaMuestra);
    if (!Number.isNaN(f.getTime())) guardado.fechaAnalisis = f;
  }
  return guardado;
};


module.exports = {
  NORMA,
  PARAMETROS,
  REQUISITOS_GENERALES,
  ErrorAnalisis,
  textoLimite,
  evaluarAnalisis,
  analisisParaGuardar
};
