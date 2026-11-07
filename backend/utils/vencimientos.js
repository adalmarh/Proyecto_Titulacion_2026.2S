// ==========================================
// VENCIMIENTO DE CERTIFICACIONES
// ------------------------------------------
// - Una certificación aprobada cuya fecha de
//   vencimiento ya pasó se marca como "vencida".
//   Lo hace el servidor al arrancar, cada hora y
//   antes de listar certificaciones.
// - Las aprobadas que vencen en los próximos
//   DIAS_AVISO días se avisan en los paneles.
// ==========================================

const Certificacion = require("../models/Certificacion");

const DIAS_AVISO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;


// Días que faltan para la fecha (0 = vence hoy;
// negativo = ya venció)
const diasParaVencer = (fecha, ahora = new Date()) => {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - ahora.getTime()) / DIA_MS);
};


// Filtro de las aprobadas que vencen dentro del plazo de aviso
const filtroPorVencer = (ahora = new Date(), dias = DIAS_AVISO) => ({
  estado: "aprobada",
  activo: true,
  fechaVencimiento: { $gte: ahora, $lte: new Date(ahora.getTime() + dias * DIA_MS) }
});


// Marca como vencidas las aprobadas cuya fecha ya pasó.
// Devuelve cuántas cambió.
const marcarCertificacionesVencidas = async (ahora = new Date()) => {
  const r = await Certificacion.updateMany(
    { estado: "aprobada", fechaVencimiento: { $lt: ahora } },
    { $set: { estado: "vencida" } }
  );
  return r.modifiedCount || 0;
};


module.exports = {
  DIAS_AVISO,
  diasParaVencer,
  filtroPorVencer,
  marcarCertificacionesVencidas
};
