const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Certificacion = require("../models/Certificacion");

const repararCertificacion = async () => {
  try {
    // ==========================================
    // CONECTAR A MONGODB
    // ==========================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado correctamente");


    // ==========================================
    // BUSCAR CERTIFICACIONES SIN CÓDIGO VÁLIDO
    // ==========================================

    const certificaciones =
      await Certificacion.find({
        $or: [
          { codigo: { $exists: false } },
          { codigo: null },
          { codigo: "" },
          { codigo: "No registrado" }
        ]
      }).sort({
        createdAt: 1
      });


    console.log(
      `Certificaciones encontradas: ${certificaciones.length}`
    );


    // ==========================================
    // SI NO HAY CERTIFICACIONES
    // ==========================================

    if (certificaciones.length === 0) {
      console.log(
        "No existen certificaciones que necesiten reparación."
      );

      await mongoose.connection.close();

      return;
    }


    // ==========================================
    // AÑO ACTUAL
    // ==========================================

    const año = new Date().getFullYear();


    // ==========================================
    // BUSCAR EL ÚLTIMO CÓDIGO DEL AÑO
    // ==========================================

    const patronCodigo =
      new RegExp(
        `^CERT-${año}-\\d{5}$`
      );


    const ultimaCertificacion =
      await Certificacion.findOne({
        codigo: patronCodigo
      }).sort({
        codigo: -1
      });


    let numero = 1;


    if (
      ultimaCertificacion &&
      ultimaCertificacion.codigo
    ) {
      const partes =
        ultimaCertificacion.codigo.split("-");

      const ultimoNumero =
        parseInt(
          partes[2],
          10
        );

      if (
        !isNaN(
          ultimoNumero
        )
      ) {
        numero =
          ultimoNumero + 1;
      }
    }


    // ==========================================
    // REPARAR CERTIFICACIONES
    // ==========================================

    for (
      const certificacion
      of certificaciones
    ) {

      const nuevoCodigo =
        `CERT-${año}-${String(numero).padStart(5, "0")}`;


      certificacion.codigo =
        nuevoCodigo;


      await certificacion.save();


      console.log(
        `Certificación ${certificacion._id} actualizada: ${nuevoCodigo}`
      );


      numero++;
    }


    // ==========================================
    // FINALIZAR
    // ==========================================

    console.log(
      "=========================================="
    );

    console.log(
      "Proceso de reparación finalizado correctamente."
    );

    console.log(
      "=========================================="
    );


    await mongoose.connection.close();

  } catch (error) {

    console.error(
      "Error al reparar las certificaciones:",
      error
    );

    await mongoose.connection.close();

    process.exit(1);
  }
};


repararCertificacion();