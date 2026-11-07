// ==========================================================
// CONVERTIR A KILOGRAMOS LA CANTIDAD DE LOS LOTES EXISTENTES
// ----------------------------------------------------------
// Desde este cambio la cantidad de cada lote se guarda
// siempre en kg. Este script convierte los lotes que se
// guardaron antes en otra unidad:
//   quintales x 45,3592 · toneladas x 1000 · gramos / 1000
// y marca como "seco" el estado del grano de los lotes que
// aún no lo tienen.
//
// Sin --confirmar solo muestra lo que haría.
//
// Uso, desde la carpeta backend:
//   node scripts/convertirCantidadesLotes.js              (revisar)
//   node scripts/convertirCantidadesLotes.js --confirmar  (aplicar)
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Lote = require("../models/Lote");
const { aKilogramos } = require("../utils/cantidades");

const CONFIRMAR = process.argv.includes("--confirmar");


const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI en el archivo .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(CONFIRMAR ? "\nMODO: APLICAR CAMBIOS\n" : "\nMODO: SOLO REVISAR (no se cambia nada)\n");

  const otrasUnidades = await Lote.find({ unidad: { $nin: ["kg", null, ""] } })
    .select("codigo cantidad unidad");

  let convertibles = 0;

  console.log(`Lotes con una unidad distinta de kg: ${otrasUnidades.length}`);

  for (const lote of otrasUnidades) {
    let kg;
    try {
      kg = aKilogramos(lote.cantidad, lote.unidad);
    } catch {
      console.log(`   - ${lote.codigo}: ${lote.cantidad} ${lote.unidad} → NO SE PUEDE CONVERTIR (revísalo a mano)`);
      continue;
    }

    convertibles += 1;
    console.log(`   - ${lote.codigo}: ${lote.cantidad} ${lote.unidad} → ${kg} kg`);

    if (CONFIRMAR) {
      await Lote.updateOne({ _id: lote._id }, { $set: { cantidad: kg, unidad: "kg" } });
    }
  }

  const sinEstado = await Lote.countDocuments({ estadoGrano: { $exists: false } });
  console.log(`\nLotes sin estado del grano (se marcan como «seco»): ${sinEstado}`);

  if (CONFIRMAR) {
    await Lote.updateMany({ estadoGrano: { $exists: false } }, { $set: { estadoGrano: "seco" } });
    await Lote.updateMany({ unidad: { $in: [null, ""] } }, { $set: { unidad: "kg" } });
    console.log(`\nCambios aplicados: ${convertibles} lotes convertidos a kg.\n`);
  } else {
    console.log("\nNo se cambió nada. Para aplicar: node scripts/convertirCantidadesLotes.js --confirmar\n");
  }
};


main()
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
