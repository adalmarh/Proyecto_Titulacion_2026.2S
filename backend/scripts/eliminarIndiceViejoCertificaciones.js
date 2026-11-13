// ==========================================================
// QUITAR EL ÍNDICE VIEJO «codigoCertificacion_1»
// ----------------------------------------------------------
// Una versión anterior del sistema guardaba el código en el
// campo «codigoCertificacion» con un índice ÚNICO. El modelo
// actual usa «codigo», así que todas las certificaciones
// nuevas llegan con codigoCertificacion = null y, desde la
// segunda, MongoDB las rechaza por «clave duplicada».
//
// Quitar un índice NO borra ninguna certificación ni ningún
// dato: solo deja de exigir que ese campo viejo sea único.
//
// Sin --confirmar solo muestra lo que haría.
//
// Uso, desde la carpeta backend:
//   node scripts/eliminarIndiceViejoCertificaciones.js
//   node scripts/eliminarIndiceViejoCertificaciones.js --confirmar
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Certificacion = require("../models/Certificacion");

const INDICE = "codigoCertificacion_1";
const CONFIRMAR = process.argv.includes("--confirmar");


const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI en el archivo .env");
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(CONFIRMAR ? "\nMODO: APLICAR CAMBIOS\n" : "\nMODO: SOLO REVISAR (no se cambia nada)\n");

  const indices = await Certificacion.collection.indexes();
  console.log("Índices actuales:");
  indices.forEach((i) => console.log(`   - ${i.name}${i.unique ? " (único)" : ""}`));

  if (!indices.some((i) => i.name === INDICE)) {
    console.log(`\nEl índice ${INDICE} no existe. No hay nada que hacer.\n`);
    return;
  }

  const total = await Certificacion.countDocuments();
  console.log(`\nSe quitará el índice ${INDICE}. Certificaciones guardadas: ${total} (no se tocan).`);

  if (CONFIRMAR) {
    await Certificacion.collection.dropIndex(INDICE);
    const despues = await Certificacion.countDocuments();
    console.log(`\nÍndice quitado. Certificaciones guardadas: ${despues}.\n`);
  } else {
    console.log("\nNo se cambió nada. Para aplicar: node scripts/eliminarIndiceViejoCertificaciones.js --confirmar\n");
  }
};

main()
  .catch((error) => { console.error("\nError:", error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
