const mongoose = require("mongoose");


// ======================================================
// ESQUEMA DE CERTIFICACIÓN
// ======================================================

const certificacionSchema =
  new mongoose.Schema(
    {

      // ==================================================
      // CÓDIGO DE CERTIFICACIÓN
      // ==================================================

      codigo: {
        type: String,
        unique: true,
        trim: true
      },


      // ==================================================
      // LOTE
      // ==================================================

      lote: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Lote",
        required: true
      },


      // ==================================================
      // SOLICITANTE
      // ==================================================

      solicitante: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
      },


      // ==================================================
      // CERTIFICADOR
      // ==================================================

      certificador: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Usuario"
      },


      // ==================================================
      // TIPO DE CERTIFICACIÓN
      // ==================================================

      tipoCertificacion: {
        type: String,
        required: true,
        trim: true
      },


      // ==================================================
      // DATOS DE LA CERTIFICACIÓN
      // ==================================================

      datosCertificacion: {

        observacionesInspeccion: {
          type: String,
          trim: true
        },

        resultadoInspeccion: {
          type: String,
          trim: true
        },

        cumplimientoRequisitos: {
          type: Boolean,
          default: false
        }

      },


      // ==================================================
      // ESTADO
      // ==================================================

      estado: {
        type: String,

        enum: [
          "pendiente",
          "en_revision",
          "aprobada",
          "rechazada",
          "vencida"
        ],

        default: "pendiente"
      },


      // ==================================================
      // FECHA DE SOLICITUD
      // ==================================================

      fechaSolicitud: {
        type: Date,
        default: Date.now
      },


      // ==================================================
      // FECHA DE INSPECCIÓN
      // ==================================================

      fechaInspeccion: {
        type: Date
      },


      // ==================================================
      // FECHA DE EMISIÓN
      // ==================================================

      fechaEmision: {
        type: Date
      },


      // ==================================================
      // FECHA DE VENCIMIENTO
      // ==================================================

      fechaVencimiento: {
        type: Date
      },


      // ==================================================
      // OBSERVACIONES
      // ==================================================

      observaciones: {
        type: String,
        trim: true
      },


      // ==================================================
      // URL DEL CERTIFICADO
      // ==================================================

      certificadoUrl: {
        type: String,
        trim: true
      },


      // ==================================================
      // CÓDIGO DE VERIFICACIÓN PÚBLICA
      // Va en el QR del certificado PDF. Es aleatorio
      // para que no se puedan adivinar otros certificados.
      // ==================================================

      codigoVerificacion: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
      },


      // ==================================================
      // FIRMA ELECTRÓNICA DEL CERTIFICADO PDF
      // Datos del PDF firmado que subió el certificador
      // (el archivo está en CertificadoFirmado).
      // ==================================================

      firma: {
        firmada: { type: Boolean, default: false },
        // manuscrita: firmada a mano (impresa y escaneada) o en Word;
        // electronica: firmada con FirmaEC u otro firmador.
        tipo: { type: String, enum: ["", "manuscrita", "electronica"], default: "" },
        firmante: { type: String, default: "" },
        identificacion: { type: String, default: "" },
        emisor: { type: String, default: "" },
        autofirmado: { type: Boolean, default: false },
        fechaFirma: { type: Date, default: null },
        certificadoHasta: { type: Date, default: null },
        sha256: { type: String, default: "" },
        fechaCarga: { type: Date, default: null },
        subidoPor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Usuario",
          default: null
        }
      },


      // ==================================================
      // ESTADO ACTIVO
      // ==================================================

      activo: {
        type: Boolean,
        default: true
      }

    },

    {
      timestamps: true
    }

  );


// ======================================================
// GENERAR CÓDIGO AUTOMÁTICAMENTE
// ======================================================

certificacionSchema.pre(
  "save",
  async function () {

    // Si ya tiene código,
    // no generar uno nuevo.

    if (
      this.codigo &&
      this.codigo.trim() !== ""
    ) {
      return;
    }


    const año =
      new Date().getFullYear();


    // Buscar la última certificación
    // creada.

    const ultimaCertificacion =
      await mongoose
        .model("Certificacion")
        .findOne({
          codigo: {
            $exists: true,
            $ne: null,
            $ne: ""
          }
        })
        .sort({
          createdAt: -1
        });


    let numero = 1;


    // ==================================================
    // OBTENER NÚMERO DE LA ÚLTIMA CERTIFICACIÓN
    // ==================================================

    if (
      ultimaCertificacion &&
      ultimaCertificacion.codigo
    ) {

      const partes =
        ultimaCertificacion.codigo
          .split("-");


      if (
        partes.length === 3
      ) {

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

    }


    // ==================================================
    // CREAR CÓDIGO
    // ==================================================

    this.codigo =
      `CERT-${año}-${String(
        numero
      ).padStart(
        5,
        "0"
      )}`;

  }
);


// ======================================================
// MODELO
// ======================================================

module.exports =
  mongoose.model(
    "Certificacion",
    certificacionSchema
  );