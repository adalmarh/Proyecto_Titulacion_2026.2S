// ==========================================
// CANTIDAD DEL LOTE
// ------------------------------------------
// La cantidad se guarda SIEMPRE en kilogramos,
// para que todos los lotes se puedan comparar y
// sumar. Se puede escribir en quintales y el
// sistema la convierte:
//   1 quintal (qq) = 100 libras = 45,3592 kg
// Además se indica el estado del grano:
//   - seco: fermentado y secado (el que se vende
//     y se certifica)
//   - baba: grano fresco, recién sacado de la
//     mazorca (pesa más o menos el doble)
// ==========================================

const KG_POR_QUINTAL = 45.3592;

const FACTOR_A_KG = {
  kg: 1,
  quintales: KG_POR_QUINTAL,
  qq: KG_POR_QUINTAL,
  toneladas: 1000,
  g: 0.001
};

const ESTADOS_GRANO = ["seco", "baba"];

class ErrorCantidad extends Error {}


// Convierte una cantidad a kilogramos (redondeada a 2 decimales)
const aKilogramos = (cantidad, unidad = "kg") => {
  const factor = FACTOR_A_KG[String(unidad || "kg").trim().toLowerCase()];
  if (!factor) {
    throw new ErrorCantidad("La unidad debe ser kg o quintales");
  }

  const numero = Number(cantidad);
  if (cantidad === "" || cantidad === null || !Number.isFinite(numero) || numero <= 0) {
    throw new ErrorCantidad("La cantidad debe ser un número mayor que cero");
  }

  return Math.round(numero * factor * 100) / 100;
};


// Valida el estado del grano (por defecto, seco)
const estadoGranoValido = (valor) => {
  const estado = String(valor || "seco").trim().toLowerCase();
  if (!ESTADOS_GRANO.includes(estado)) {
    throw new ErrorCantidad("El estado del grano debe ser «seco» o «baba»");
  }
  return estado;
};


// Quintales equivalentes, para mostrar (1 decimal)
const aQuintales = (kg) => Math.round((Number(kg) / KG_POR_QUINTAL) * 10) / 10;


module.exports = {
  KG_POR_QUINTAL,
  ESTADOS_GRANO,
  ErrorCantidad,
  aKilogramos,
  aQuintales,
  estadoGranoValido
};
