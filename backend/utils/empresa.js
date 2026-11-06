// ==========================================
// DATOS DE LA EMPRESA
// Todos los productores pertenecen a una sola
// empresa: la que usa el sistema y emite los
// certificados. Sus datos se configuran en el
// archivo .env (EMPRESA_NOMBRE, EMPRESA_RUC,
// EMPRESA_CIUDAD) y aparecen en el certificado
// PDF, la consulta pública del QR y la
// verificación de certificados.
// ==========================================

const NOMBRE_POR_DEFECTO = "Cacaotera Aroma del Litoral S.A.";

const datosEmpresa = () => ({
  nombre: (process.env.EMPRESA_NOMBRE || "").trim() || NOMBRE_POR_DEFECTO,
  ruc: (process.env.EMPRESA_RUC || "").trim(),
  ciudad: (process.env.EMPRESA_CIUDAD || "").trim()
});

module.exports = { datosEmpresa, NOMBRE_POR_DEFECTO };
