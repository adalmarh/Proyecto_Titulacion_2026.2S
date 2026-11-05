// ==========================================================
// PRUEBAS DE LAS SOLICITUDES DE CUENTA
// No necesitan MongoDB: prueban las validaciones y las
// reglas de quién puede revisar cada solicitud.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const { cedulaValida, emailValido, celularValido } = require("../utils/validaciones");
const crearLimitador = require("../utils/limitador");
const SolicitudCuenta = require("../models/SolicitudCuenta");
const {
  limpiarSolicitudesRechazadas,
  validarDatosSolicitud,
  direccionCompleta,
  filtroSolicitudes,
  puedeRevisar
} = require("../controllers/solicitudController");

const ASOC_1 = "64b000000000000000000001";
const ASOC_2 = "64b000000000000000000002";

const base = {
  nombre: "Pedro",
  apellido: "Alcívar",
  cedula: "1710034065",
  telefono: "099 123 4567",
  provincia: "Guayas",
  canton: "Milagro",
  parroquia: "Recinto Los Monos",
  direccion: "Finca La Ceiba, km 5 vía a Naranjito",
  email: "Pedro@Finca.ec ",
  password: "cacao123",
  aceptaPrivacidad: true,
  rolSolicitado: "productor",
  asociacion: ASOC_1
};

const falla = (datos, texto) =>
  assert.throws(() => validarDatosSolicitud(datos), (e) => e.status === 400 && e.message.includes(texto));


test("cédula ecuatoriana: dígito verificador, provincia y tercer dígito", () => {
  assert.equal(cedulaValida("1710034065"), true);
  assert.equal(cedulaValida("0912345675"), true);
  assert.equal(cedulaValida("1710034064"), false, "verificador incorrecto");
  assert.equal(cedulaValida("2510034065"), false, "provincia inexistente");
  assert.equal(cedulaValida("0960000001"), false, "tercer dígito de persona jurídica");
  assert.equal(cedulaValida("171003406"), false, "9 dígitos");
  assert.equal(cedulaValida("17100340AB"), false, "letras");
});

test("correo electrónico", () => {
  assert.equal(emailValido("ana@asociacion.ec"), true);
  assert.equal(emailValido("ana@asociacion"), false);
  assert.equal(emailValido("ana asociacion.ec"), false);
});

test("una solicitud válida se normaliza", () => {
  const datos = validarDatosSolicitud(base);
  assert.equal(datos.email, "pedro@finca.ec");
  assert.equal(datos.rolSolicitado, "productor");
  assert.equal(datos.asociacion, ASOC_1);
});

test("no se pueden pedir los roles administrador ni certificador", () => {
  falla({ ...base, rolSolicitado: "administrador" }, "productor o de asociación");
  falla({ ...base, rolSolicitado: "certificador" }, "productor o de asociación");
});

test("datos obligatorios y formatos", () => {
  falla({ ...base, nombre: "" }, "Completa");
  falla({ ...base, cedula: "1234567890" }, "cédula");
  falla({ ...base, email: "pedro" }, "correo");
  falla({ ...base, password: "123" }, "contraseña");
  falla({ ...base, telefono: "abc" }, "celular");
  falla({ ...base, mensaje: "x".repeat(501) }, "500");
});

test("celular ecuatoriano", () => {
  assert.equal(celularValido("0991234567"), true);
  assert.equal(celularValido("099-123-4567"), true);
  assert.equal(celularValido("042712345"), false, "teléfono fijo");
  assert.equal(celularValido("099123456"), false, "9 dígitos");
});

test("celular y ubicación son obligatorios para verificar en campo", () => {
  falla({ ...base, telefono: "" }, "celular es obligatorio");
  falla({ ...base, telefono: "042712345" }, "09");
  falla({ ...base, provincia: "" }, "provincia");
  falla({ ...base, provincia: "Narnia" }, "provincia");
  falla({ ...base, canton: "" }, "cantón");
  falla({ ...base, parroquia: "" }, "recinto");
  falla({ ...base, direccion: "Finca" }, "llegar a tu finca");
  const datos = validarDatosSolicitud(base);
  assert.equal(datos.telefono, "0991234567", "se guarda sin espacios");
});

test("la asociación no necesita parroquia, pero sí la dirección de su sede", () => {
  const asoc = { ...base, rolSolicitado: "asociacion", parroquia: "" };
  assert.equal(validarDatosSolicitud(asoc).parroquia, "");
  falla({ ...asoc, direccion: "" }, "sede");
});

test("la dirección de la ficha del productor se arma en una línea", () => {
  assert.equal(
    direccionCompleta(validarDatosSolicitud(base)),
    "Finca La Ceiba, km 5 vía a Naranjito, Recinto Los Monos, Milagro, Guayas"
  );
});

test("sin aceptar el aviso de privacidad no se envía la solicitud", () => {
  falla({ ...base, aceptaPrivacidad: false }, "aviso de privacidad");
  falla({ ...base, aceptaPrivacidad: undefined }, "aviso de privacidad");
  falla({ ...base, aceptaPrivacidad: "si" }, "aviso de privacidad");
});

test("el productor debe indicar su asociación", () => {
  falla({ ...base, asociacion: "" }, "asociación");
  falla({ ...base, asociacion: "no-es-un-id" }, "asociación");
});

test("la asociación puede elegir una existente o escribir el nombre de una nueva", () => {
  const nueva = validarDatosSolicitud({ ...base, rolSolicitado: "asociacion", asociacion: "", nombreAsociacion: "Cacao Fino del Guayas" });
  assert.equal(nueva.asociacion, null);
  assert.equal(nueva.nombreAsociacion, "Cacao Fino del Guayas");
  falla({ ...base, rolSolicitado: "asociacion", asociacion: "", nombreAsociacion: "" }, "asociación");
});

test("quién revisa cada solicitud", () => {
  const admin = { rol: "administrador" };
  const asoc1 = { rol: "asociacion", asociacion: ASOC_1 };
  const productor = { rol: "productor" };

  const deProductorA1 = { rolSolicitado: "productor", asociacion: ASOC_1 };
  const deProductorA2 = { rolSolicitado: "productor", asociacion: ASOC_2 };
  const deAsociacion = { rolSolicitado: "asociacion", asociacion: ASOC_1 };

  assert.equal(puedeRevisar(admin, deProductorA2), true);
  assert.equal(puedeRevisar(admin, deAsociacion), true);
  assert.equal(puedeRevisar(asoc1, deProductorA1), true);
  assert.equal(puedeRevisar(asoc1, deProductorA2), false, "productor de otra asociación");
  assert.equal(puedeRevisar(asoc1, deAsociacion), false, "solo el administrador aprueba asociaciones");
  assert.equal(puedeRevisar(productor, deProductorA1), false);

  assert.deepEqual(filtroSolicitudes(admin), {});
  assert.deepEqual(filtroSolicitudes(asoc1), { rolSolicitado: "productor", asociacion: ASOC_1 });
});

test("el limitador corta después del máximo de peticiones", () => {
  const limitar = crearLimitador({ maximo: 2, ventanaMs: 60000, mensaje: "Demasiadas" });
  const estados = [];

  for (let i = 0; i < 3; i++) {
    const res = { status: (c) => ({ json: () => estados.push(c) }) };
    limitar({ ip: "1.2.3.4" }, res, () => estados.push(200));
  }

  assert.deepEqual(estados, [200, 200, 429]);
});

test("se eliminan solo las solicitudes rechazadas hace más de 180 días", async () => {
  const original = SolicitudCuenta.deleteMany;
  let filtro = null;
  SolicitudCuenta.deleteMany = async (f) => { filtro = f; return { deletedCount: 3 }; };

  try {
    const ahora = new Date("2026-10-25T12:00:00Z");
    const eliminadas = await limpiarSolicitudesRechazadas(ahora);

    assert.equal(eliminadas, 3);
    assert.equal(filtro.estado, "rechazada");
    assert.equal(filtro.fechaRevision.$lt.toISOString(), "2026-04-28T12:00:00.000Z");
  } finally {
    SolicitudCuenta.deleteMany = original;
  }
});
