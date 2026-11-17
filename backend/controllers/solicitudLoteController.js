const SolicitudLote = require("../models/SolicitudLote");
const Productor = require("../models/Productor");

const { obtenerProductorPropio } = require("../middleware/alcanceMiddleware");
const { aKilogramos, estadoGranoValido, ErrorCantidad } = require("../utils/cantidades");
const { validarProduccion, ErrorProduccion } = require("../utils/produccionEstimada");


// ==========================================================
// SOLICITUDES DE LOTE
//   - El productor solicita un lote nuevo y puede cancelar
//     su solicitud mientras esté pendiente.
//   - El administrador las revisa: las aprueba creando el
//     lote (POST /api/lotes con «solicitudLote», ver
//     loteController.crearLote) o las rechaza con un motivo.
// ==========================================================

const MAX_PENDIENTES = 3;

class ErrorSolicitudLote extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

const texto = (v) => String(v ?? "").trim();

const responder = (res, error, mensaje) => {
  if (error instanceof ErrorSolicitudLote) {
    return res.status(error.estado).json({ mensaje: error.message });
  }
  console.error(`${mensaje}:`, error);
  return res.status(500).json({ mensaje, error: error.message });
};

const poblar = (consulta) =>
  consulta
    .populate("productor", "nombre apellido cedula ubicacion produccion")
    .populate("lote", "codigo")
    .populate("revisadoPor", "nombre apellido");


// Valida los datos del formulario (función pura)
const validarSolicitudLote = (datos = {}) => {
  const { cantidad, unidad, estadoGrano, fechaSiembra, fechaEstimadaCosecha } = datos;

  if (cantidad === undefined || cantidad === null || texto(cantidad) === "") {
    throw new ErrorSolicitudLote("Indica la cantidad aproximada de cacao del lote");
  }

  let cantidadKg;
  let grano;
  let fechas;
  try {
    cantidadKg = aKilogramos(String(cantidad).replace(",", "."), unidad || "kg");
    grano = estadoGranoValido(estadoGrano);
    fechas = validarProduccion({ fechaSiembra, fechaEstimadaCosecha });
  } catch (error) {
    if (error instanceof ErrorCantidad || error instanceof ErrorProduccion) {
      throw new ErrorSolicitudLote(error.message);
    }
    throw error;
  }

  if (cantidadKg > 100000) {
    throw new ErrorSolicitudLote("La cantidad parece demasiado alta (máximo 100 000 kg por lote)");
  }

  const mensaje = texto(datos.mensaje);
  if (mensaje.length > 500) {
    throw new ErrorSolicitudLote("El mensaje admite hasta 500 caracteres");
  }

  return {
    cantidadKg,
    estadoGrano: grano,
    fechaSiembra: fechas.fechaSiembra,
    fechaEstimadaCosecha: fechas.fechaEstimadaCosecha,
    mensaje
  };
};


// ==========================================
// CREAR (productor)
// POST /api/solicitudes-lote
// ==========================================
const crearSolicitudLote = async (req, res) => {
  try {
    const propio = await obtenerProductorPropio(req);
    if (!propio) {
      throw new ErrorSolicitudLote("Tu cuenta no está vinculada a una ficha de productor activa. Comunícate con el administrador.", 403);
    }

    const datos = validarSolicitudLote(req.body || {});

    const pendientes = await SolicitudLote.countDocuments({ productor: propio._id, estado: "pendiente" });
    if (pendientes >= MAX_PENDIENTES) {
      throw new ErrorSolicitudLote(`Ya tienes ${MAX_PENDIENTES} solicitudes de lote pendientes. Espera a que el administrador las revise.`);
    }

    const solicitud = await SolicitudLote.create({
      ...datos,
      productor: propio._id,
      solicitadoPor: req.usuario._id
    });

    return res.status(201).json({
      mensaje: "Solicitud de lote enviada al administrador",
      solicitud: await poblar(SolicitudLote.findById(solicitud._id))
    });
  } catch (error) {
    return responder(res, error, "Error al enviar la solicitud de lote");
  }
};


// ==========================================
// LISTAR
// GET /api/solicitudes-lote?estado=pendiente
// Administrador: todas. Productor: solo las suyas.
// ==========================================
const listarSolicitudesLote = async (req, res) => {
  try {
    const filtro = {};

    if (req.usuario.rol === "productor") {
      const propio = await obtenerProductorPropio(req);
      if (!propio) return res.json({ total: 0, solicitudes: [] });
      filtro.productor = propio._id;
    } else if (req.usuario.rol !== "administrador") {
      throw new ErrorSolicitudLote("No tienes permiso para ver las solicitudes de lote", 403);
    }

    if (["pendiente", "aprobada", "rechazada", "cancelada"].includes(req.query.estado)) {
      filtro.estado = req.query.estado;
    }

    const solicitudes = await poblar(SolicitudLote.find(filtro).sort({ createdAt: -1 }).limit(200));
    return res.json({ total: solicitudes.length, solicitudes });
  } catch (error) {
    return responder(res, error, "Error al obtener las solicitudes de lote");
  }
};


// ==========================================
// TOTAL DE PENDIENTES (administrador)
// GET /api/solicitudes-lote/pendientes/total
// ==========================================
const totalPendientesLote = async (req, res) => {
  try {
    return res.json({ total: await SolicitudLote.countDocuments({ estado: "pendiente" }) });
  } catch (error) {
    return responder(res, error, "Error al contar las solicitudes de lote");
  }
};


// ==========================================
// CANCELAR (productor, solo las suyas pendientes)
// PATCH /api/solicitudes-lote/:id/cancelar
// ==========================================
const cancelarSolicitudLote = async (req, res) => {
  try {
    const propio = await obtenerProductorPropio(req);
    const solicitud = await SolicitudLote.findById(req.params.id);

    if (!solicitud) throw new ErrorSolicitudLote("La solicitud no existe", 404);
    if (!propio || String(solicitud.productor) !== String(propio._id)) {
      throw new ErrorSolicitudLote("Solo puedes cancelar tus propias solicitudes", 403);
    }
    if (solicitud.estado !== "pendiente") {
      throw new ErrorSolicitudLote("Solo se pueden cancelar solicitudes pendientes");
    }

    solicitud.estado = "cancelada";
    await solicitud.save();

    return res.json({ mensaje: "Solicitud cancelada", solicitud });
  } catch (error) {
    return responder(res, error, "Error al cancelar la solicitud de lote");
  }
};


// ==========================================
// RECHAZAR (administrador)
// PATCH /api/solicitudes-lote/:id/rechazar
// Body: { motivo }
// ==========================================
const rechazarSolicitudLote = async (req, res) => {
  try {
    const motivo = texto(req.body?.motivo);
    if (motivo.length < 5) {
      throw new ErrorSolicitudLote("Indica el motivo del rechazo (al menos 5 caracteres)");
    }
    if (motivo.length > 500) {
      throw new ErrorSolicitudLote("El motivo admite hasta 500 caracteres");
    }

    const solicitud = await SolicitudLote.findById(req.params.id);
    if (!solicitud) throw new ErrorSolicitudLote("La solicitud no existe", 404);
    if (solicitud.estado !== "pendiente") {
      throw new ErrorSolicitudLote("Esta solicitud ya fue revisada o cancelada");
    }

    solicitud.estado = "rechazada";
    solicitud.motivoRechazo = motivo;
    solicitud.revisadoPor = req.usuario._id;
    solicitud.fechaRevision = new Date();
    await solicitud.save();

    return res.json({ mensaje: "Solicitud de lote rechazada", solicitud });
  } catch (error) {
    return responder(res, error, "Error al rechazar la solicitud de lote");
  }
};


// ==========================================
// PARA crearLote: comprueba que la solicitud que se
// aprueba exista, esté pendiente y sea del productor
// del lote. Devuelve el documento o lanza un error.
// ==========================================
const solicitudParaAprobar = async (idSolicitud, idProductor) => {
  const solicitud = await SolicitudLote.findById(idSolicitud);
  if (!solicitud) throw new ErrorSolicitudLote("La solicitud de lote no existe", 404);
  if (solicitud.estado !== "pendiente") {
    throw new ErrorSolicitudLote("Esta solicitud de lote ya fue revisada o cancelada");
  }
  if (String(solicitud.productor) !== String(idProductor)) {
    throw new ErrorSolicitudLote("El lote debe ser del mismo productor que hizo la solicitud");
  }
  // la ficha del productor debe seguir activa
  const productor = await Productor.findById(idProductor).select("activo");
  if (!productor || productor.activo === false) {
    throw new ErrorSolicitudLote("El productor de la solicitud no está activo");
  }
  return solicitud;
};


module.exports = {
  ErrorSolicitudLote,
  MAX_PENDIENTES,
  validarSolicitudLote,
  crearSolicitudLote,
  listarSolicitudesLote,
  totalPendientesLote,
  cancelarSolicitudLote,
  rechazarSolicitudLote,
  solicitudParaAprobar
};
