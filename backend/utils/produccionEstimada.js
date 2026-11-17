// ==========================================================
// PRODUCCIÓN ESTIMADA DEL PRODUCTOR
// ----------------------------------------------------------
// Lo que el productor declara al solicitar su cuenta y que el
// administrador puede corregir en su ficha:
//   - cantidad aproximada por cosecha (se guarda en kg; se
//     puede escribir en quintales, como en el lote)
//   - fecha de siembra del cacaotal
//   - fecha estimada de la próxima cosecha
// Al registrar un lote nuevo, estos datos llenan solos la
// cantidad y las fechas (el administrador puede cambiarlos).
// ==========================================================

const { aKilogramos, ErrorCantidad } = require("./cantidades");

class ErrorProduccion extends Error {}

const MAX_KG = 100000;          // 100 toneladas por cosecha
const ANIO_MINIMO = 1950;
const DIAS_FUTURO_COSECHA = 730; // hasta 2 años adelante

const vacio = (v) => v === undefined || v === null || String(v).trim() === "";

// Convierte "2026-11-16" o una fecha en Date (o null si no es válida)
const aFecha = (valor) => {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};


// Valida los datos. Con obligatorio = true (solicitud de cuenta)
// los tres datos son necesarios; en la ficha del productor son
// opcionales, pero si se escriben deben ser correctos.
// Devuelve { cantidadEstimadaKg, fechaSiembra, fechaEstimadaCosecha }
// con null en los que quedaron vacíos.
const validarProduccion = (datos = {}, { obligatorio = false, hoy = new Date() } = {}) => {
  const { cantidadEstimada, unidadEstimada, fechaSiembra, fechaEstimadaCosecha } = datos || {};

  if (obligatorio) {
    if (vacio(cantidadEstimada)) throw new ErrorProduccion("Indica la cantidad aproximada de cacao que da tu cosecha");
    if (vacio(fechaSiembra)) throw new ErrorProduccion("Indica la fecha de siembra de tu cacaotal");
    if (vacio(fechaEstimadaCosecha)) throw new ErrorProduccion("Indica la fecha estimada de tu próxima cosecha");
  }

  // ---------- Cantidad ----------
  let cantidadEstimadaKg = null;
  if (!vacio(cantidadEstimada)) {
    try {
      cantidadEstimadaKg = aKilogramos(String(cantidadEstimada).replace(",", "."), unidadEstimada || "kg");
    } catch (error) {
      if (error instanceof ErrorCantidad) {
        throw new ErrorProduccion(`Cantidad aproximada: ${error.message.charAt(0).toLowerCase()}${error.message.slice(1)}`);
      }
      throw error;
    }
    if (cantidadEstimadaKg > MAX_KG) {
      throw new ErrorProduccion("La cantidad aproximada parece demasiado alta (máximo 100 000 kg por cosecha)");
    }
  }

  // ---------- Fecha de siembra ----------
  let siembra = null;
  if (!vacio(fechaSiembra)) {
    siembra = aFecha(fechaSiembra);
    if (!siembra) throw new ErrorProduccion("La fecha de siembra no es válida");
    if (siembra > hoy) throw new ErrorProduccion("La fecha de siembra no puede ser posterior a hoy");
    if (siembra.getUTCFullYear() < ANIO_MINIMO) throw new ErrorProduccion(`La fecha de siembra debe ser desde ${ANIO_MINIMO}`);
  }

  // ---------- Fecha estimada de cosecha ----------
  let cosecha = null;
  if (!vacio(fechaEstimadaCosecha)) {
    cosecha = aFecha(fechaEstimadaCosecha);
    if (!cosecha) throw new ErrorProduccion("La fecha estimada de cosecha no es válida");
    if (siembra && cosecha <= siembra) {
      throw new ErrorProduccion("La fecha estimada de cosecha debe ser posterior a la siembra");
    }
    const limite = new Date(hoy.getTime() + DIAS_FUTURO_COSECHA * 86400000);
    if (cosecha > limite) {
      throw new ErrorProduccion("La fecha estimada de cosecha debe estar dentro de los próximos 2 años");
    }
  }

  return {
    cantidadEstimadaKg,
    fechaSiembra: siembra,
    fechaEstimadaCosecha: cosecha
  };
};


module.exports = {
  ErrorProduccion,
  validarProduccion
};
