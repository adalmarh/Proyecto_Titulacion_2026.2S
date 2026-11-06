// ==========================================================
// ELIMINAR LAS ASOCIACIONES (cambio a empresa única)
// ----------------------------------------------------------
// Desde este cambio todos los productores pertenecen a una
// sola empresa y ya no existe el rol "asociacion". Este
// script limpia los datos que quedaron de antes:
//
//   1. Borra las cuentas con rol "asociacion".
//   2. Borra las solicitudes de cuenta de tipo "asociacion".
//   3. Borra todas las asociaciones registradas.
//   4. Quita el campo "asociacion" de productores, lotes,
//      usuarios y solicitudes (los datos del productor y del
//      lote se conservan).
//
// SEGURIDAD
//   - Sin --confirmar SOLO MUESTRA lo que haría; no cambia
//     nada.
//   - Con --confirmar hace los cambios. NO SE PUEDEN DESHACER:
//     antes, saca una copia de la base de datos (mongodump o
//     "Export Collection" en MongoDB Compass).
//
// Uso, desde la carpeta backend:
//   node scripts/eliminarAsociaciones.js              (revisar)
//   node scripts/eliminarAsociaciones.js --confirmar  (aplicar)
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const CONFIRMAR = process.argv.includes("--confirmar");

// Nombre de la colección que Mongoose usaba para cada modelo
const coleccion = (modelo) => mongoose.pluralize()(modelo);

const nombreCompleto = (u) => `${u.nombre || ""} ${u.apellido || ""}`.trim();


const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI en el archivo .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`\nBase de datos: ${db.databaseName}`);
  console.log(CONFIRMAR ? "MODO: APLICAR CAMBIOS\n" : "MODO: SOLO REVISAR (no se cambia nada)\n");

  const usuarios = db.collection(coleccion("Usuario"));
  const productores = db.collection(coleccion("Productor"));
  const lotes = db.collection(coleccion("Lote"));
  const solicitudes = db.collection(coleccion("SolicitudCuenta"));
  const asociaciones = db.collection(coleccion("Asociacion"));
  const eventos = db.collection(coleccion("EventoTrazabilidad"));
  const certificaciones = db.collection(coleccion("Certificacion"));

  // ---------- Qué hay ----------
  const cuentas = await usuarios.find({ rol: "asociacion" })
    .project({ nombre: 1, apellido: 1, email: 1 }).toArray();
  const idsCuentas = cuentas.map((u) => u._id);

  const listaAsociaciones = await asociaciones.find({})
    .project({ nombre: 1 }).toArray();

  const conCampo = { asociacion: { $exists: true } };
  const resumen = {
    solicitudesAsociacion: await solicitudes.countDocuments({ rolSolicitado: "asociacion" }),
    productores: await productores.countDocuments(conCampo),
    lotes: await lotes.countDocuments(conCampo),
    usuarios: await usuarios.countDocuments({ ...conCampo, rol: { $ne: "asociacion" } }),
    solicitudes: await solicitudes.countDocuments({
      rolSolicitado: { $ne: "asociacion" },
      $or: [conCampo, { nombreAsociacion: { $exists: true } }]
    }),
    eventosDeCuentas: idsCuentas.length
      ? await eventos.countDocuments({ responsable: { $in: idsCuentas } })
      : 0,
    certificacionesDeCuentas: idsCuentas.length
      ? await certificaciones.countDocuments({ solicitante: { $in: idsCuentas } })
      : 0
  };

  console.log(`Cuentas con rol asociación que se BORRAN: ${cuentas.length}`);
  cuentas.forEach((u) => console.log(`   - ${nombreCompleto(u)} <${u.email}>`));

  console.log(`Asociaciones que se BORRAN: ${listaAsociaciones.length}`);
  listaAsociaciones.forEach((a) => console.log(`   - ${a.nombre}`));

  console.log(`Solicitudes de cuenta de asociación que se BORRAN: ${resumen.solicitudesAsociacion}`);
  console.log("\nSe les QUITA el campo «asociación» (el resto de sus datos se conserva):");
  console.log(`   - productores: ${resumen.productores}`);
  console.log(`   - lotes: ${resumen.lotes}`);
  console.log(`   - otras cuentas: ${resumen.usuarios}`);
  console.log(`   - solicitudes de productores: ${resumen.solicitudes}`);

  if (resumen.eventosDeCuentas || resumen.certificacionesDeCuentas) {
    console.log("\nAVISO: registros hechos por esas cuentas. Se CONSERVAN, pero ya no");
    console.log("mostrarán el nombre de quien los hizo:");
    console.log(`   - actividades de trazabilidad: ${resumen.eventosDeCuentas}`);
    console.log(`   - solicitudes de certificación: ${resumen.certificacionesDeCuentas}`);
  }

  if (!CONFIRMAR) {
    console.log("\nNo se cambió nada. Para aplicar, saca una copia de la base y ejecuta:");
    console.log("   node scripts/eliminarAsociaciones.js --confirmar\n");
    return;
  }

  // ---------- Aplicar ----------
  const quitar = { $unset: { asociacion: "" } };

  const r1 = await usuarios.deleteMany({ rol: "asociacion" });
  const r2 = await solicitudes.deleteMany({ rolSolicitado: "asociacion" });
  const r3 = await asociaciones.deleteMany({});
  const r4 = await productores.updateMany(conCampo, quitar);
  const r5 = await lotes.updateMany(conCampo, quitar);
  const r6 = await usuarios.updateMany(conCampo, quitar);
  const r7 = await solicitudes.updateMany({}, { $unset: { asociacion: "", nombreAsociacion: "" } });

  // Índice que ya no se usa
  await solicitudes.dropIndex("asociacion_1_estado_1").catch(() => {});

  console.log("\nCAMBIOS APLICADOS");
  console.log(`   Cuentas de asociación borradas: ${r1.deletedCount}`);
  console.log(`   Solicitudes de asociación borradas: ${r2.deletedCount}`);
  console.log(`   Asociaciones borradas: ${r3.deletedCount}`);
  console.log(`   Productores actualizados: ${r4.modifiedCount}`);
  console.log(`   Lotes actualizados: ${r5.modifiedCount}`);
  console.log(`   Cuentas actualizadas: ${r6.modifiedCount}`);
  console.log(`   Solicitudes actualizadas: ${r7.modifiedCount}\n`);
};


main()
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
