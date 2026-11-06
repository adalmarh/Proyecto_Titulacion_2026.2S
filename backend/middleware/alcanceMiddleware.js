const mongoose = require("mongoose");

const Lote = require("../models/Lote");
const Productor = require("../models/Productor");
const Certificacion = require("../models/Certificacion");
const EventoTrazabilidad = require("../models/EventoTrazabilidad");


// ======================================================
// ALCANCE POR ROL
// ------------------------------------------------------
// Este módulo decide QUÉ DATOS puede ver y modificar
// cada usuario según su rol:
//
//  - administrador: todo el sistema (representa a la
//                   empresa a la que pertenecen todos
//                   los productores).
//  - productor:     solo SUS lotes (el Productor cuyo
//                   campo "usuario" apunta a él).
//  - certificador:  solo los lotes de las certificaciones
//                   que tiene asignadas (lectura).
//
// Debe usarse SIEMPRE después de protegerRuta,
// porque necesita req.usuario.
// ======================================================

const ROLES = {
  ADMIN: "administrador",
  PRODUCTOR: "productor",
  CERTIFICADOR: "certificador"
};

// Filtro que no coincide con ningún documento.
const NINGUNO = { _id: null };

const mismoId = (a, b) =>
  a != null && b != null && String(a) === String(b);

const idValido = (id) =>
  mongoose.Types.ObjectId.isValid(id);


// ======================================================
// PRODUCTOR VINCULADO AL USUARIO (rol productor)
// Se guarda en la petición para no consultarlo dos veces.
// ======================================================

const obtenerProductorPropio = async (req) => {
  if (req._productorPropio !== undefined) {
    return req._productorPropio;
  }

  req._productorPropio = await Productor.findOne({
    usuario: req.usuario._id,
    activo: true
  }).select("_id");

  return req._productorPropio;
};


// ======================================================
// FILTROS DE CONSULTA (para los listados)
// ======================================================

// Lotes que el usuario puede VER.
const filtroLotes = async (req) => {
  if (req._filtroLotes) {
    return req._filtroLotes;
  }

  const usuario = req.usuario;
  let filtro = NINGUNO;

  if (usuario.rol === ROLES.ADMIN) {
    filtro = {};
  } else if (usuario.rol === ROLES.PRODUCTOR) {
    const propio = await obtenerProductorPropio(req);
    filtro = propio ? { productor: propio._id } : NINGUNO;
  } else if (usuario.rol === ROLES.CERTIFICADOR) {
    const lotes = await Certificacion.distinct("lote", {
      certificador: usuario._id,
      activo: true
    });
    filtro = { _id: { $in: lotes } };
  }

  req._filtroLotes = filtro;
  return filtro;
};

// Identificadores de los lotes visibles
// (se usa para filtrar eventos y certificaciones).
const idsLotesVisibles = async (req) => {
  const filtro = await filtroLotes(req);
  return Lote.distinct("_id", filtro);
};

// Productores que el usuario puede VER.
const filtroProductores = async (req) => {
  const usuario = req.usuario;

  if (usuario.rol === ROLES.ADMIN) {
    return {};
  }

  if (usuario.rol === ROLES.PRODUCTOR) {
    const propio = await obtenerProductorPropio(req);
    return propio ? { _id: propio._id } : NINGUNO;
  }

  if (usuario.rol === ROLES.CERTIFICADOR) {
    const filtro = await filtroLotes(req);
    const productores = await Lote.distinct("productor", filtro);
    return { _id: { $in: productores } };
  }

  return NINGUNO;
};

// Eventos de trazabilidad que el usuario puede VER.
const filtroEventos = async (req) => {
  if (req.usuario.rol === ROLES.ADMIN) {
    return {};
  }

  return { lote: { $in: await idsLotesVisibles(req) } };
};

// Certificaciones que el usuario puede VER.
const filtroCertificaciones = async (req) => {
  const usuario = req.usuario;

  if (usuario.rol === ROLES.ADMIN) {
    return {};
  }

  if (usuario.rol === ROLES.CERTIFICADOR) {
    return { certificador: usuario._id };
  }

  return { lote: { $in: await idsLotesVisibles(req) } };
};


// ======================================================
// REGLAS SOBRE UN LOTE CONCRETO
// ======================================================

// ¿Puede VER este lote?
const puedeVerLote = async (req, lote) => {
  if (req.usuario.rol === ROLES.ADMIN) {
    return true;
  }

  const filtro = await filtroLotes(req);
  const existe = await Lote.exists({
    $and: [{ _id: lote._id }, filtro]
  });

  return Boolean(existe);
};

// ¿Puede GESTIONAR este lote? (registrar eventos,
// solicitar certificación, generar su QR...)
const puedeGestionarLote = async (req, lote) => {
  const usuario = req.usuario;

  if (usuario.rol === ROLES.ADMIN) {
    return true;
  }

  if (usuario.rol === ROLES.PRODUCTOR) {
    const propio = await obtenerProductorPropio(req);
    return Boolean(propio) && mismoId(lote.productor, propio._id);
  }

  // El certificador solo consulta lotes.
  return false;
};


// ======================================================
// MIDDLEWARES PARA LAS RUTAS
// ======================================================

const responderSinAcceso = (res, recurso) =>
  res.status(403).json({
    mensaje: `No tienes acceso a ${recurso}`
  });

const manejarError = (res, error) => {
  console.error("Error al verificar permisos:", error);

  return res.status(500).json({
    mensaje: "Error al verificar los permisos"
  });
};

// Verifica el acceso a un lote. "obtenerId" indica de
// dónde sale su id, por ejemplo: (req) => req.params.id
// modo: "ver" o "gestionar".
const accesoLote = (obtenerId, modo = "ver") =>
  async (req, res, next) => {
    try {
      const loteId = obtenerId(req);

      if (!loteId) {
        return res.status(400).json({
          mensaje: "Debe indicar el lote"
        });
      }

      if (!idValido(loteId)) {
        return res.status(400).json({
          mensaje: "El identificador del lote no es válido"
        });
      }

      const lote = await Lote.findById(loteId)
        .select("_id productor");

      if (!lote) {
        return res.status(404).json({
          mensaje: "El lote no existe"
        });
      }

      const permitido = modo === "gestionar"
        ? await puedeGestionarLote(req, lote)
        : await puedeVerLote(req, lote);

      if (!permitido) {
        return responderSinAcceso(res, "este lote");
      }

      return next();
    } catch (error) {
      return manejarError(res, error);
    }
  };

// Verifica el acceso a un evento de trazabilidad
// (a través del lote al que pertenece).
const accesoEvento = (modo = "ver") =>
  async (req, res, next) => {
    try {
      if (!idValido(req.params.id)) {
        return res.status(400).json({
          mensaje: "El identificador del evento no es válido"
        });
      }

      const evento = await EventoTrazabilidad
        .findById(req.params.id)
        .select("lote responsable");

      if (!evento) {
        return res.status(404).json({
          mensaje: "El evento no existe"
        });
      }

      const lote = await Lote.findById(evento.lote)
        .select("_id productor");

      if (!lote) {
        return res.status(404).json({
          mensaje: "El lote del evento no existe"
        });
      }

      let permitido = modo === "gestionar"
        ? await puedeGestionarLote(req, lote)
        : await puedeVerLote(req, lote);

      // Un productor solo modifica los eventos
      // que él mismo registró.
      if (
        permitido &&
        modo === "gestionar" &&
        req.usuario.rol === ROLES.PRODUCTOR
      ) {
        permitido = mismoId(evento.responsable, req.usuario._id);
      }

      if (!permitido) {
        return responderSinAcceso(res, "este evento");
      }

      return next();
    } catch (error) {
      return manejarError(res, error);
    }
  };

// Verifica que el usuario pueda VER una certificación.
const accesoCertificacion = () =>
  async (req, res, next) => {
    try {
      if (!idValido(req.params.id)) {
        return res.status(400).json({
          mensaje: "El identificador de la certificación no es válido"
        });
      }

      const filtro = await filtroCertificaciones(req);
      const existe = await Certificacion.exists({
        $and: [{ _id: req.params.id }, filtro]
      });

      if (!existe) {
        const hay = await Certificacion.exists({ _id: req.params.id });

        return hay
          ? responderSinAcceso(res, "esta certificación")
          : res.status(404).json({
            mensaje: "La certificación no existe"
          });
      }

      return next();
    } catch (error) {
      return manejarError(res, error);
    }
  };

// Verifica que el usuario pueda GESTIONAR un productor.
// Solo el administrador (la empresa) gestiona productores.
const accesoProductor = () =>
  (req, res, next) => {
    if (req.usuario.rol === ROLES.ADMIN) {
      return next();
    }

    return responderSinAcceso(res, "este productor");
  };

// Quita del cuerpo los campos que solo el administrador
// puede cambiar (por ejemplo, el usuario vinculado a un
// productor).
const soloAdminPuedeCambiar = (...campos) =>
  (req, res, next) => {
    if (req.usuario.rol !== ROLES.ADMIN && req.body) {
      campos.forEach((campo) => {
        delete req.body[campo];
      });
    }

    return next();
  };


module.exports = {
  ROLES,
  filtroLotes,
  filtroProductores,
  filtroEventos,
  filtroCertificaciones,
  puedeVerLote,
  puedeGestionarLote,
  accesoLote,
  accesoEvento,
  accesoCertificacion,
  accesoProductor,
  soloAdminPuedeCambiar
};
