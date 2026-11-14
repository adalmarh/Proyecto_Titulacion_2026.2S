// ==========================================================
// COPIAR LA BASE DE DATOS LOCAL A MONGODB ATLAS
// ----------------------------------------------------------
// Copia todas las colecciones (usuarios, productores, lotes,
// trazabilidad, certificaciones, certificados firmados,
// códigos QR, solicitudes) de la base de ORIGEN a la base de
// DESTINO, conservando los mismos _id.
//
//   ORIGEN : MONGO_URI del archivo .env (tu computadora)
//   DESTINO: MONGO_URI_DESTINO (la cadena de Atlas)
//
// La base de ORIGEN solo se LEE; nunca se modifica.
// Si el destino ya tiene datos, el script se detiene para no
// mezclar ni duplicar nada.
// Los índices los crea el backend al arrancar conectado a
// Atlas (así no se copian índices viejos que ya no se usan).
//
// Sin --confirmar solo muestra lo que haría.
//
// Uso, desde la carpeta backend (PowerShell):
//   $env:MONGO_URI_DESTINO="mongodb+srv://..."
//   node scripts/copiarBaseDatos.js
//   node scripts/copiarBaseDatos.js --confirmar
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const CONFIRMAR = process.argv.includes("--confirmar");
const LOTE = 200;
const LIMITE_ATLAS_MB = 512;

// Oculta usuario y contraseña al mostrar una cadena
const ocultar = (uri) => String(uri).replace(/\/\/[^@]*@/, "//***:***@");


const main = async () => {
  const origenUri = process.env.MONGO_URI;
  const destinoUri = process.env.MONGO_URI_DESTINO;

  if (!origenUri) throw new Error("Falta MONGO_URI (base de origen) en el archivo .env");
  if (!destinoUri) throw new Error("Falta MONGO_URI_DESTINO (la cadena de conexión de Atlas)");
  if (origenUri.trim() === destinoUri.trim()) throw new Error("El origen y el destino son la misma base de datos");

  console.log(CONFIRMAR ? "\nMODO: COPIAR\n" : "\nMODO: SOLO REVISAR (no se copia nada)\n");
  console.log(`Origen : ${ocultar(origenUri)}`);
  console.log(`Destino: ${ocultar(destinoUri)}\n`);

  const origen = await mongoose.createConnection(origenUri).asPromise();
  const destino = await mongoose.createConnection(destinoUri).asPromise();

  try {
    const colecciones = (await origen.db.listCollections().toArray())
      .filter((c) => c.type !== "view" && !c.name.startsWith("system."))
      .map((c) => c.name)
      .sort();

    const estadisticas = await origen.db.stats();
    const tamanoMB = (estadisticas.dataSize || 0) / 1024 / 1024;

    console.log(`Base de origen: ${origen.db.databaseName} · ${tamanoMB.toFixed(1)} MB de datos`);
    console.log(`Base de destino: ${destino.db.databaseName}\n`);

    if (tamanoMB > LIMITE_ATLAS_MB * 0.9) {
      throw new Error(`Los datos (${tamanoMB.toFixed(0)} MB) no caben bien en el plan gratuito de Atlas (${LIMITE_ATLAS_MB} MB)`);
    }

    let conDatosEnDestino = 0;
    const resumen = [];

    for (const nombre of colecciones) {
      const enOrigen = await origen.db.collection(nombre).countDocuments();
      const enDestino = await destino.db.collection(nombre).countDocuments();
      if (enDestino > 0) conDatosEnDestino += 1;
      resumen.push({ nombre, enOrigen, enDestino });
      console.log(`   - ${nombre.padEnd(22)} origen: ${String(enOrigen).padStart(5)}   destino: ${String(enDestino).padStart(5)}`);
    }

    if (conDatosEnDestino > 0) {
      throw new Error(
        "La base de destino ya tiene datos. Para no duplicarlos, el script no copia nada. " +
        "Usa una base vacía en Atlas (por ejemplo, otro nombre de base en la cadena de conexión)."
      );
    }

    if (!CONFIRMAR) {
      console.log("\nNo se copió nada. Para copiar: node scripts/copiarBaseDatos.js --confirmar\n");
      return;
    }

    console.log("\nCopiando...");

    for (const { nombre, enOrigen } of resumen) {
      if (enOrigen === 0) continue;

      const cursor = origen.db.collection(nombre).find({});
      let lote = [];
      let copiados = 0;

      for await (const documento of cursor) {
        lote.push(documento);
        if (lote.length === LOTE) {
          await destino.db.collection(nombre).insertMany(lote, { ordered: true });
          copiados += lote.length;
          lote = [];
        }
      }
      if (lote.length > 0) {
        await destino.db.collection(nombre).insertMany(lote, { ordered: true });
        copiados += lote.length;
      }

      const verificados = await destino.db.collection(nombre).countDocuments();
      const ok = verificados === enOrigen;
      console.log(`   ${ok ? "OK   " : "REVISAR"} ${nombre.padEnd(22)} ${copiados} copiados · en destino: ${verificados}`);
      if (!ok) process.exitCode = 1;
    }

    console.log(
      process.exitCode
        ? "\nTerminó con diferencias: revisa las colecciones marcadas.\n"
        : "\nCopia terminada. Tu base local no se modificó.\n"
    );

  } finally {
    await origen.close();
    await destino.close();
  }
};


main().catch((error) => {
  console.error("\nError:", error.message);
  process.exitCode = 1;
});
