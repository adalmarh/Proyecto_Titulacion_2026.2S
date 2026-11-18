// ==========================================================
// UNIFICAR EL TIPO DE LAS CERTIFICACIONES EXISTENTES
// ----------------------------------------------------------
// Desde este cambio el sistema tiene un solo tipo:
//   «Calidad y trazabilidad del cacao fino de aroma (NTE INEN 176)»
// Este script pasa a ese nombre las certificaciones antiguas
// (Buenas Prácticas Agrícolas, Producción Orgánica, etc.).
//
// NO cambia las certificaciones FIRMADAS: el tipo está impreso
// en su PDF firmado o forma parte de la firma del sistema, y
// cambiarlo haría que la verificación las muestre como
// alteradas. Esas conservan su tipo original.
//
// Sin --confirmar solo muestra lo que haría.
//
// Uso, desde la carpeta backend:
//   npm run unificar-tipo
//   npm run unificar-tipo -- --confirmar
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Certificacion = require("../models/Certificacion");
const { TIPO_CERTIFICACION } = require("../utils/normaInen176");

const CONFIRMAR = process.argv.includes("--confirmar");


const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI en el archivo .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(CONFIRMAR ? "\nMODO: APLICAR CAMBIOS\n" : "\nMODO: SOLO REVISAR (no se cambia nada)\n");
  console.log(`Tipo único: «${TIPO_CERTIFICACION}»\n`);

  const otras = await Certificacion.find({ tipoCertificacion: { $ne: TIPO_CERTIFICACION } })
    .select("codigo tipoCertificacion estado firma.firmada");

  const cambiar = otras.filter((c) => !c.firma?.firmada);
  const firmadas = otras.filter((c) => c.firma?.firmada);

  console.log(`Se cambian (sin firmar): ${cambiar.length}`);
  cambiar.forEach((c) => console.log(`   - ${c.codigo || c._id} · ${c.estado} · «${c.tipoCertificacion}»`));

  console.log(`\nSe conservan (ya firmadas): ${firmadas.length}`);
  firmadas.forEach((c) => console.log(`   - ${c.codigo || c._id} · ${c.estado} · «${c.tipoCertificacion}»`));

  if (CONFIRMAR && cambiar.length > 0) {
    const r = await Certificacion.updateMany(
      { _id: { $in: cambiar.map((c) => c._id) } },
      { $set: { tipoCertificacion: TIPO_CERTIFICACION } }
    );
    console.log(`\nCambios aplicados: ${r.modifiedCount} certificaciones.\n`);
  } else if (!CONFIRMAR) {
    console.log("\nNo se cambió nada. Para aplicar: npm run unificar-tipo -- --confirmar\n");
  } else {
    console.log("\nNo hay nada que cambiar.\n");
  }
};


main()
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
