// ==========================================================
// NTE INEN 176:2021 «Granos de cacao. Requisitos»
// ----------------------------------------------------------
// Copia de la Tabla 1 de la norma para mostrar el grado
// mientras el certificador escribe el análisis y para la
// página pública /normativa/inen-176.
// La que manda es la del backend (backend/utils/normaInen176.js):
// el grado se vuelve a calcular allí al aprobar.
// ==========================================================

export const NORMA = {
  codigo: "NTE INEN 176:2021",
  titulo: "Granos de cacao. Requisitos",
  revision: "Sexta revisión",
  entidad: "Servicio Ecuatoriano de Normalización (INEN)"
};

// Texto de la norma (copia pública publicada por ANECACAO)
export const URL_TEXTO_NORMA =
  "https://anecacao.com/wp-content/uploads/2024/04/NTE-INEN-176-SEXTA-REVISION-1.pdf";

export const PARAMETROS_INEN = [
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

export const REQUISITOS_GENERALES_INEN = [
  { clave: "sinHumo", nombre: "Sin olor ni sabor a humo ni señales de contaminación por humo" },
  { clave: "sinInfestacion", nombre: "Granos libres de infestación (insectos vivos)" }
];

const coma = (v) => String(v).replace(".", ",");

export const textoLimite = (p, i) => {
  if (p.tipo === "max") return `máx. ${coma(p.limites[i])} ${p.unidad}`;
  if (p.tipo === "min") return `mín. ${coma(p.limites[i])} ${p.unidad}`;
  if (i === 0) return "más de 130 g";
  if (i === 1) return "más de 120 a 130 g";
  return "100 a 120 g";
};

const cumpleGrado = (p, valor, i) => {
  if (p.tipo === "max") return valor <= p.limites[i];
  if (p.tipo === "min") return valor >= p.limites[i];
  if (i === 0) return valor > 130;
  if (i === 1) return valor > 120;
  return valor >= 100;
};

// Grado de un parámetro: 1, 2, 3, 0 (no cumple) o null (vacío o inválido)
export const gradoParametro = (p, texto) => {
  if (texto === "" || texto === null || texto === undefined) return null;
  const valor = Number(String(texto).replace(",", "."));
  if (!Number.isFinite(valor) || valor < 0 || (p.unidad === "%" && valor > 100)) return null;
  const i = [0, 1, 2].find((k) => cumpleGrado(p, valor, k));
  return i === undefined ? 0 : i + 1;
};

// Resultado de todo el análisis mientras se escribe
export const evaluarAnalisisInen = (valores) => {
  const grados = PARAMETROS_INEN.map((p) => gradoParametro(p, valores[p.clave]));
  const faltan = grados.filter((g) => g === null).length;
  const fallan = PARAMETROS_INEN.filter((p, i) => grados[i] === 0).map((p) => p.nombre);
  const generalesFallan = REQUISITOS_GENERALES_INEN.filter((r) => !valores[r.clave]).map((r) => r.nombre);

  if (fallan.length > 0) return { estado: "no_cumple", grados, motivos: fallan };
  if (faltan > 0) return { estado: "incompleto", grados, faltan };
  if (generalesFallan.length > 0) return { estado: "no_cumple", grados, motivos: generalesFallan };
  return { estado: "cumple", grados, grado: Math.max(...grados) };
};

// Valores numéricos para enviar al backend
export const analisisParaEnviar = (valores) => {
  const datos = {};
  PARAMETROS_INEN.forEach((p) => {
    datos[p.clave] = Number(String(valores[p.clave]).replace(",", "."));
  });
  REQUISITOS_GENERALES_INEN.forEach((r) => { datos[r.clave] = Boolean(valores[r.clave]); });
  return datos;
};
