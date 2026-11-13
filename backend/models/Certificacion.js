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
        },

        // Análisis de calidad según la NTE INEN 176:2021
        // (ver utils/normaInen176.js). El grado lo calcula
        // el backend: 1, 2, 3 o null si no cumple.
        analisisInen: {
          norma: { type: String, trim: true },
          humedad: Number,
          peso100Granos: Number,
          bienFermentados: Number,
          violetas: Number,
          pizarrosos: Number,
          mohosos: Number,
          defectuosos: Number,
          materialRelacionado: Number,
          materiaExtrana: Number,
          sinHumo: Boolean,
          sinInfestacion: Boolean,
          grado: { type: Number, default: null },
          fechaAnalisis: Date
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

    const Modelo =
      mongoose.model("Certificacion");


    // Se busca el número MÁS ALTO del año (ordenando por
    // código), no la última certificación creada: si los
    // datos se cargaron en otro orden, la última creada
    // puede no tener el número mayor y el código nuevo
    // saldría repetido (error de código duplicado).

    const ultimaDelAño =
      await Modelo
        .findOne({
          codigo: new RegExp(`^CERT-${año}-\\d{5}$`)
        })
        .sort({ codigo: -1 })
        .select("codigo");


    let numero = 1;

    if (ultimaDelAño?.codigo) {
      const ultimoNumero =
        parseInt(ultimaDelAño.codigo.split("-")[2], 10);

      if (!isNaN(ultimoNumero)) {
        numero = ultimoNumero + 1;
      }
    }


    // Por seguridad, si el código ya existe se prueba
    // con el siguiente.

    const armar = (n) =>
      `CERT-${año}-${String(n).padStart(5, "0")}`;

    while (await Modelo.exists({ codigo: armar(numero) })) {
      numero += 1;
    }

    this.codigo = armar(numero);

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