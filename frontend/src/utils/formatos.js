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

// Unidades de medida de los lotes
export const UNIDADES = ["kg", "quintales", "toneladas", "g"];


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
