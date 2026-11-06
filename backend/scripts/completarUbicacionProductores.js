// ==========================================================
// COMPLETAR LA UBICACIÓN DE LOS PRODUCTORES EXISTENTES
// ----------------------------------------------------------
// Desde este cambio cada productor guarda la ubicación de su
// finca, y el formulario de nuevo lote la copia al elegirlo.
// Este script la completa en los productores registrados
// antes, tomando (en este orden):
//   1. Los datos de su solicitud de cuenta aprobada.
//   2. La ubicación de su lote más reciente.
//
// Solo llena productores que aún no tienen cantón. No borra
// ni cambia nada más.
//
// Uso, desde la carpeta backend:
//   node scripts/completarUbicacionProductores.js              (revisar)
//   node scripts/completarUbicacionProductores.js --confirmar  (aplicar)
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Productor = require("../models/Productor");
const Lote = require("../models/Lote");
const SolicitudCuenta = require("../models/SolicitudCuenta");

const CONFIRMAR = process.argv.includes("--confirmar");
const texto = (v) => String(v ?? "").trim();


const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI en el archivo .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(CONFIRMAR ? "\nMODO: APLICAR CAMBIOS\n" : "\nMODO: SOLO REVISAR (no se cambia nada)\n");

  const productores = await Productor.find({
    $or: [{ "ubicacion.canton": { $in: [null, ""] } }, { ubicacion: { $exists: false } }]
  });

  let completados = 0;

  for (const p of productores) {
    let ubicacion = null;
    let origen = "";

    const solicitud = await SolicitudCuenta.findOne({ cedula: p.cedula, estado: "aprobada" })
      .sort({ fechaRevision: -1 });

    if (solicitud?.canton) {
      ubicacion = {
        provincia: texto(solicitud.provincia),
        canton: texto(solicitud.canton),
        parroquia: texto(solicitud.parroquia),
        descripcion: texto(solicitud.direccion)
      };
      origen = "su solicitud de cuenta";
    } else {
      const lote = await Lote.findOne({ productor: p._id, "ubicacion.canton": { $nin: [null, ""] } })
        .sort({ createdAt: -1 });

      if (lote) {
        ubicacion = {
          provincia: texto(lote.ubicacion.provincia),
          canton: texto(lote.ubicacion.canton),
          parroquia: texto(lote.ubicacion.parroquia),
          descripcion: texto(lote.ubicacion.descripcion)
        };
        origen = `su lote ${lote.codigo}`;
      }
    }

    const nombre = `${p.nombre} ${p.apellido}`;

    if (!ubicacion) {
      console.log(`   - ${nombre}: sin datos; complétala en Productores → Editar`);
      continue;
    }

    const lugar = [ubicacion.parroquia, ubicacion.canton, ubicacion.provincia].filter(Boolean).join(", ");
    console.log(`   - ${nombre}: ${lugar} (de ${origen})`);
    completados += 1;

    if (CONFIRMAR) {
      await Productor.updateOne({ _id: p._id }, { $set: { ubicacion } });
    }
  }

  console.log(`\nProductores sin ubicación: ${productores.length}. Se pueden completar: ${completados}.`);
  console.log(CONFIRMAR
    ? "Cambios aplicados.\n"
    : "No se cambió nada. Para aplicar: node scripts/completarUbicacionProductores.js --confirmar\n");
};


main()
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
