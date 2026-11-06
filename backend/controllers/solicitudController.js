const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SolicitudCuenta = require("../models/SolicitudCuenta");
const Usuario = require("../models/Usuario");
const Productor = require("../models/Productor");

const {
  VERSION_AVISO_PRIVACIDAD,
  DIAS_CONSERVAR_RECHAZADAS
} = require("../utils/privacidad");

const {
  cedulaValida,
  emailValido,
  normalizarCelular,
  celularValido,
  PROVINCIAS_ECUADOR
} = require("../utils/validaciones");


// ==========================================================
// SOLICITUDES DE CUENTA
// 1. Un productor envía la solicitud desde el inicio de
//    sesión (ruta pública).
// 2. El administrador (la empresa) la revisa.
// 3. Al aprobar se crea la cuenta y su ficha de productor
//    (o se vincula la que ya existía con esa cédula).
// Todos los productores pertenecen a la misma empresa.
// ==========================================================

const LONGITUD_MINIMA_PASSWORD = 6;

const idValido = (id) => mongoose.Types.ObjectId.isValid(id);
const texto = (valor) => String(valor ?? "").trim();

class ErrorSolicitud extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const responderError = (res, error, mensajeGeneral) => {
  if (error instanceof ErrorSolicitud) {
    return res.status(error.status).json({ mensaje: error.message });
  }

  console.error(`${mensajeGeneral}:`, error);
  return res.status(500).json({ mensaje: mensajeGeneral });
};


// ==========================================
// VALIDAR LOS DATOS DEL FORMULARIO
// (función pura: se prueba sin base de datos)
// ==========================================

const validarDatosSolicitud = (datos = {}) => {
  const nombre = texto(datos.nombre);
  const apellido = texto(datos.apellido);
  const cedula = texto(datos.cedula);
  const telefono = normalizarCelular(datos.telefono);
  const provincia = texto(datos.provincia);
  const canton = texto(datos.canton);
  const parroquia = texto(datos.parroquia);
  const direccion = texto(datos.direccion);
  const email = texto(datos.email).toLowerCase();
  const password = String(datos.password ?? "");
  const rolSolicitado = texto(datos.rolSolicitado) || "productor";
  const mensaje = texto(datos.mensaje);

  if (!nombre || !apellido || !cedula || !email || !password) {
    throw new ErrorSolicitud("Completa nombre, apellido, cédula, correo y contraseña");
  }

  if (nombre.length > 60 || apellido.length > 60) {
    throw new ErrorSolicitud("El nombre y el apellido admiten hasta 60 caracteres");
  }

  if (rolSolicitado !== "productor") {
    throw new ErrorSolicitud("Solo se pueden solicitar cuentas de productor");
  }

  if (!cedulaValida(cedula)) {
    throw new ErrorSolicitud("La cédula no es válida");
  }

  if (!emailValido(email)) {
    throw new ErrorSolicitud("El correo electrónico no es válido");
  }

  // ---------- Contacto y ubicación (para verificar en campo) ----------
  if (!telefono) {
    throw new ErrorSolicitud("El número de celular es obligatorio");
  }

  if (!celularValido(telefono)) {
    throw new ErrorSolicitud("El celular debe tener 10 dígitos y empezar con 09");
  }

  if (!PROVINCIAS_ECUADOR.includes(provincia)) {
    throw new ErrorSolicitud("Selecciona la provincia");
  }

  if (!canton) {
    throw new ErrorSolicitud("Indica el cantón");
  }

  if (!parroquia) {
    throw new ErrorSolicitud("Indica la parroquia o el recinto donde está tu finca");
  }

  if (direccion.length < 10) {
    throw new ErrorSolicitud("Describe cómo llegar a tu finca (al menos 10 caracteres)");
  }

  if (canton.length > 60 || parroquia.length > 60 || direccion.length > 200) {
    throw new ErrorSolicitud("El cantón y la parroquia admiten hasta 60 caracteres, y la dirección hasta 200");
  }

  if (password.length < LONGITUD_MINIMA_PASSWORD || password.length > 72) {
    throw new ErrorSolicitud(`La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y 72 caracteres`);
  }

  if (mensaje.length > 500) {
    throw new ErrorSolicitud("El mensaje admite hasta 500 caracteres");
  }

  // Consentimiento expreso (LOPDP, art. 8)
  if (datos.aceptaPrivacidad !== true && datos.aceptaPrivacidad !== "true") {
    throw new ErrorSolicitud("Debes leer y aceptar el aviso de privacidad para enviar la solicitud");
  }

  return {
    nombre,
    apellido,
    cedula,
    telefono,
    provincia,
    canton,
    parroquia,
    direccion,
    email,
    password,
    rolSolicitado,
    mensaje
  };
};


// ==========================================
// PÚBLICO: ENVIAR SOLICITUD
// ==========================================

const crearSolicitud = async (req, res) => {
  try {
    // Campo trampa: las personas no lo ven; los
    // programas automáticos suelen llenarlo.
    if (texto(req.body?.sitioWeb)) {
      return res.status(201).json({
        mensaje: "Solicitud enviada correctamente"
      });
    }

    const datos = validarDatosSolicitud(req.body || {});

    if (await Usuario.exists({ email: datos.email })) {
      throw new ErrorSolicitud("Ya existe una cuenta con ese correo. Inicia sesión con ella.");
    }

    if (await SolicitudCuenta.exists({ email: datos.email, estado: "pendiente" })) {
      throw new ErrorSolicitud("Ya hay una solicitud pendiente con ese correo");
    }

    if (await SolicitudCuenta.exists({ cedula: datos.cedula, estado: "pendiente" })) {
      throw new ErrorSolicitud("Ya hay una solicitud pendiente con esa cédula");
    }

    const productor = await Productor.findOne({ cedula: datos.cedula }).select("usuario");
    if (productor?.usuario) {
      throw new ErrorSolicitud("Esa cédula ya tiene una cuenta. Inicia sesión con ella.");
    }

    await SolicitudCuenta.create({
      ...datos,
      password: await bcrypt.hash(datos.password, await bcrypt.genSalt(10)),
      consentimiento: {
        version: VERSION_AVISO_PRIVACIDAD,
        fecha: new Date()
      }
    });

    return res.status(201).json({
      mensaje: "Solicitud enviada correctamente"
    });

  } catch (error) {
    return responderError(res, error, "Error al enviar la solicitud");
  }
};


// ==========================================
// ALCANCE: solo el administrador revisa
// (la ruta ya lo exige; esto es una segunda
// barrera por si se reutiliza el controlador).
// ==========================================

const filtroSolicitudes = () => ({});

const puedeRevisar = (usuario) => usuario.rol === "administrador";

const buscarParaRevisar = async (req) => {
  if (!idValido(req.params.id)) {
    throw new ErrorSolicitud("El identificador no es válido");
  }

  const solicitud = await SolicitudCuenta.findById(req.params.id);

  if (!solicitud) {
    throw new ErrorSolicitud("La solicitud no existe", 404);
  }

  if (!puedeRevisar(req.usuario)) {
    throw new ErrorSolicitud("No tienes acceso a esta solicitud", 403);
  }

  if (solicitud.estado !== "pendiente") {
    throw new ErrorSolicitud("Esta solicitud ya fue revisada");
  }

  return solicitud;
};


// ==========================================
// LISTAR (administrador)
// ?estado=pendiente|aprobada|rechazada
// ==========================================

const obtenerSolicitudes = async (req, res) => {
  try {
    const filtro = filtroSolicitudes();

    if (["pendiente", "aprobada", "rechazada"].includes(req.query.estado)) {
      filtro.estado = req.query.estado;
    }

    const solicitudes = await SolicitudCuenta.find(filtro)
      .select("-password")
      .populate("revisadoPor", "nombre apellido")
      .sort({ createdAt: -1 })
      .lean();

    // Para las pendientes de productor: ¿ya existe una
    // ficha de productor con esa cédula?
    const cedulas = solicitudes
      .filter((s) => s.estado === "pendiente")
      .map((s) => s.cedula);

    const productores = cedulas.length
      ? await Productor.find({ cedula: { $in: cedulas } })
        .select("nombre apellido cedula usuario")
        .lean()
      : [];

    const porCedula = new Map(productores.map((p) => [p.cedula, p]));

    return res.status(200).json({
      total: solicitudes.length,
      solicitudes: solicitudes.map((s) => {
        const p = s.estado === "pendiente" ? porCedula.get(s.cedula) : null;
        return {
          ...s,
          productorExistente: p
            ? {
              _id: p._id,
              nombre: p.nombre,
              apellido: p.apellido,
              tieneCuenta: Boolean(p.usuario)
            }
            : null
        };
      })
    });

  } catch (error) {
    return responderError(res, error, "Error al obtener las solicitudes");
  }
};


// ==========================================
// TOTAL DE PENDIENTES (para el menú)
// ==========================================

const contarPendientes = async (req, res) => {
  try {
    const total = await SolicitudCuenta.countDocuments({
      ...filtroSolicitudes(),
      estado: "pendiente"
    });

    return res.status(200).json({ total });
  } catch (error) {
    return responderError(res, error, "Error al contar las solicitudes");
  }
};


// Dirección de la finca en una sola línea para la ficha
// del productor: "referencia, parroquia, cantón, provincia"
const direccionCompleta = (s) =>
  [s.direccion, s.parroquia, s.canton, s.provincia]
    .map(texto)
    .filter(Boolean)
    .join(", ");


// Ubicación de la finca para la ficha del productor
// (se copia luego a cada lote nuevo)
const ubicacionFinca = (s) => ({
  provincia: texto(s.provincia),
  canton: texto(s.canton),
  parroquia: texto(s.parroquia),
  descripcion: texto(s.direccion)
});


// ==========================================
// APROBAR: crea la cuenta del productor
// ==========================================

const aprobarSolicitud = async (req, res) => {
  let productorNuevo = null;

  try {
    const solicitud = await buscarParaRevisar(req);

    if (await Usuario.exists({ email: solicitud.email })) {
      throw new ErrorSolicitud("Ya existe una cuenta con ese correo");
    }

    // ---------- Productor: ficha nueva o existente ----------
    let productor = await Productor.findOne({ cedula: solicitud.cedula });

    if (productor) {
      if (productor.usuario) {
        throw new ErrorSolicitud("Esa cédula ya tiene una cuenta");
      }
      // Completar la ficha sin borrar lo que ya tenía
      if (!productor.telefono && solicitud.telefono) productor.telefono = solicitud.telefono;
      if (!productor.email) productor.email = solicitud.email;
      if (!productor.direccion && direccionCompleta(solicitud)) productor.direccion = direccionCompleta(solicitud);
      if (!productor.ubicacion?.canton) productor.ubicacion = ubicacionFinca(solicitud);
    } else {
      productor = await Productor.create({
        nombre: solicitud.nombre,
        apellido: solicitud.apellido,
        cedula: solicitud.cedula,
        telefono: solicitud.telefono,
        email: solicitud.email,
        direccion: direccionCompleta(solicitud),
        ubicacion: ubicacionFinca(solicitud)
      });
      productorNuevo = productor;
    }

    // ---------- Cuenta ----------
    const usuario = await Usuario.create({
      nombre: solicitud.nombre,
      apellido: solicitud.apellido,
      email: solicitud.email,
      password: solicitud.password, // ya está cifrada
      telefono: solicitud.telefono || "",
      rol: "productor",
      // El consentimiento que dio al enviar la solicitud
      consentimiento: solicitud.consentimiento?.version
        ? { version: solicitud.consentimiento.version, fecha: solicitud.consentimiento.fecha }
        : undefined
    });

    if (productor) {
      productor.usuario = usuario._id;
      productor.activo = true;
      await productor.save();
    }

    solicitud.estado = "aprobada";
    solicitud.revisadoPor = req.usuario._id;
    solicitud.fechaRevision = new Date();
    solicitud.usuarioCreado = usuario._id;
    solicitud.password = undefined; // ya está en la cuenta; no se guarda dos veces
    await solicitud.save();

    return res.status(200).json({
      mensaje: `Cuenta de ${solicitud.nombre} ${solicitud.apellido} creada correctamente`,
      solicitud: { ...solicitud.toObject(), password: undefined }
    });

  } catch (error) {
    // Si la cuenta no se pudo crear, no dejar una ficha huérfana
    if (productorNuevo) {
      await Productor.deleteOne({ _id: productorNuevo._id }).catch(() => {});
    }
    return responderError(res, error, "Error al aprobar la solicitud");
  }
};


// ==========================================
// RECHAZAR
// body: { motivo }  (obligatorio)
// ==========================================

const rechazarSolicitud = async (req, res) => {
  try {
    const motivo = texto(req.body?.motivo);

    if (motivo.length < 5) {
      throw new ErrorSolicitud("Indica el motivo del rechazo");
    }

    const solicitud = await buscarParaRevisar(req);

    solicitud.estado = "rechazada";
    solicitud.motivoRechazo = motivo.slice(0, 300);
    solicitud.revisadoPor = req.usuario._id;
    solicitud.fechaRevision = new Date();
    await solicitud.save();

    return res.status(200).json({
      mensaje: "Solicitud rechazada",
      solicitud: { ...solicitud.toObject(), password: undefined }
    });

  } catch (error) {
    return responderError(res, error, "Error al rechazar la solicitud");
  }
};


// ==========================================
// LIMPIEZA: solicitudes rechazadas antiguas
// No se conservan datos personales más tiempo
// del necesario (principio de conservación).
// Se ejecuta al iniciar el servidor y cada día.
// ==========================================

const limpiarSolicitudesRechazadas = async (ahora = new Date()) => {
  const limite = new Date(ahora.getTime() - DIAS_CONSERVAR_RECHAZADAS * 24 * 60 * 60 * 1000);

  const resultado = await SolicitudCuenta.deleteMany({
    estado: "rechazada",
    fechaRevision: { $lt: limite }
  });

  return resultado.deletedCount || 0;
};


// ==========================================
// ESTADO PARA EL INICIO DE SESIÓN
// Si alguien intenta entrar y aún no tiene cuenta,
// se le dice si su solicitud sigue pendiente o fue
// rechazada, pero SOLO si la contraseña coincide con
// la de la solicitud (para no revelar datos ajenos).
// ==========================================

const estadoSolicitudParaLogin = async (email, password) => {
  const solicitud = await SolicitudCuenta.findOne({
    email: texto(email).toLowerCase(),
    estado: { $in: ["pendiente", "rechazada"] }
  }).sort({ createdAt: -1 });

  if (!solicitud?.password || !(await bcrypt.compare(String(password), solicitud.password))) {
    return null;
  }

  return solicitud.estado === "pendiente"
    ? "Tu solicitud de cuenta aún está pendiente de aprobación"
    : `Tu solicitud de cuenta fue rechazada: ${solicitud.motivoRechazo}`;
};


module.exports = {
  validarDatosSolicitud,
  direccionCompleta,
  ubicacionFinca,
  filtroSolicitudes,
  puedeRevisar,
  crearSolicitud,
  obtenerSolicitudes,
  contarPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
  limpiarSolicitudesRechazadas,
  estadoSolicitudParaLogin
};
