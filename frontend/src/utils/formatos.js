// ==========================================
// TEXTOS Y FORMATOS COMPARTIDOS
// ==========================================

export const NOMBRE_ESTADO_LOTE = {
  activo: "Activo",
  en_produccion: "En producción",
  cosechado: "Cosechado",
  almacenado: "Almacenado",
  transportado: "Transportado",
  distribuido: "Distribuido",
  finalizado: "Finalizado"
};

export const NOMBRE_ESTADO_CERTIFICACION = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  vencida: "Vencida"
};

export const NOMBRE_TIPO_EVENTO = {
  siembra: "Siembra",
  riego: "Riego",
  fertilizacion: "Fertilización",
  fumigacion: "Fumigación",
  control_fitosanitario: "Control fitosanitario",
  cosecha: "Cosecha",
  almacenamiento: "Almacenamiento",
  procesamiento: "Procesamiento",
  control_calidad: "Control de calidad",
  certificacion: "Certificación",
  transporte: "Transporte",
  distribucion: "Distribución",
  otro: "Otro"
};


// Fecha legible en español (ej.: 5 oct 2026).
// Las fechas guardadas sin hora (medianoche UTC) se muestran
// en UTC para que no aparezcan un día antes en Ecuador.
export const formatearFecha = (valor) => {
  if (!valor) {
    return "—";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }

  const soloFecha =
    fecha.getUTCHours() === 0 &&
    fecha.getUTCMinutes() === 0 &&
    fecha.getUTCSeconds() === 0;

  return fecha.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(soloFecha ? { timeZone: "UTC" } : {})
  });
};


// Nombre completo de una persona (objeto populado o vacío)
export const nombreCompleto = (persona) =>
  persona && typeof persona === "object"
    ? `${persona.nombre || ""} ${persona.apellido || ""}`.trim()
    : "—";


// Tipos de certificación que se pueden solicitar
export const TIPOS_CERTIFICACION = [
  "Buenas Prácticas Agrícolas",
  "Producción Orgánica",
  "Calidad del Producto",
  "Trazabilidad Agrícola",
  "Certificación Sanitaria"
];

// ---------- Cantidad del lote ----------
// Se guarda siempre en kg; se puede escribir en quintales.
// 1 quintal (qq) = 100 libras = 45,3592 kg
export const KG_POR_QUINTAL = 45.3592;

export const UNIDADES_ENTRADA = [
  { valor: "kg", texto: "Kilogramos (kg)" },
  { valor: "quintales", texto: "Quintales (qq)" }
];

export const ESTADOS_GRANO = {
  seco: "Seco (fermentado y secado)",
  baba: "En baba (fresco)"
};

const numeroEC = (n, decimales = 2) =>
  Number(n).toLocaleString("es-EC", { maximumFractionDigits: decimales });

// "1.200 kg (≈ 26,5 qq)"; con grano: "1.200 kg (≈ 26,5 qq) · seco"
export const formatearCantidad = (cantidad, estadoGrano, { grano = false } = {}) => {
  if (cantidad === null || cantidad === undefined || cantidad === "") return "—";
  const kg = Number(cantidad);
  const qq = Math.round((kg / KG_POR_QUINTAL) * 10) / 10;
  const texto = `${numeroEC(kg)} kg (≈ ${numeroEC(qq, 1)} qq)`;
  if (!grano) return texto;
  return `${texto} · ${estadoGrano === "baba" ? "en baba" : "seco"}`;
};


// Fecha y hora (para actividades registradas con hora)
export const formatearFechaHora = (valor) => {
  if (!valor) {
    return "—";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }

  const soloFecha =
    fecha.getUTCHours() === 0 &&
    fecha.getUTCMinutes() === 0;

  return soloFecha
    ? formatearFecha(valor)
    : fecha.toLocaleString("es-EC", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
};


// Id de una referencia (objeto populado o id simple)
export const idDe = (valor) =>
  (valor && typeof valor === "object" ? valor._id : valor) || "";


// Las 24 provincias del Ecuador
export const PROVINCIAS_ECUADOR = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
  "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
  "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
  "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas",
  "Sucumbíos", "Tungurahua", "Zamora Chinchipe"
];

// Días que faltan para una fecha (0 = hoy; negativo = ya pasó)
export const diasParaVencer = (fecha) => {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};
