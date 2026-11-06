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
  ubicacionFinca,
  filtroSolicitudes,
  puedeRevisar
} = require("../controllers/solicitudController");

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
  rolSolicitado: "productor"
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
  assert.equal(datos.asociacion, undefined, "ya no se pide asociación");
});

test("solo se piden cuentas de productor", () => {
  falla({ ...base, rolSolicitado: "administrador" }, "Solo se pueden solicitar cuentas de productor");
  falla({ ...base, rolSolicitado: "certificador" }, "Solo se pueden solicitar cuentas de productor");
  falla({ ...base, rolSolicitado: "asociacion" }, "Solo se pueden solicitar cuentas de productor");
  assert.equal(validarDatosSolicitud({ ...base, rolSolicitado: undefined }).rolSolicitado, "productor", "sin tipo, es productor");
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

test("la parroquia y la forma de llegar a la finca son obligatorias", () => {
  falla({ ...base, parroquia: "" }, "parroquia");
  falla({ ...base, direccion: "cerca" }, "finca");
});

test("la dirección de la ficha del productor se arma en una línea", () => {
  assert.equal(
    direccionCompleta(validarDatosSolicitud(base)),
    "Finca La Ceiba, km 5 vía a Naranjito, Recinto Los Monos, Milagro, Guayas"
  );
});

test("la ubicación de la finca pasa a la ficha del productor", () => {
  assert.deepEqual(ubicacionFinca(validarDatosSolicitud(base)), {
    provincia: "Guayas",
    canton: "Milagro",
    parroquia: "Recinto Los Monos",
    descripcion: "Finca La Ceiba, km 5 vía a Naranjito"
  });
});

test("sin aceptar el aviso de privacidad no se envía la solicitud", () => {
  falla({ ...base, aceptaPrivacidad: false }, "aviso de privacidad");
  falla({ ...base, aceptaPrivacidad: undefined }, "aviso de privacidad");
  falla({ ...base, aceptaPrivacidad: "si" }, "aviso de privacidad");
});

test("solo el administrador revisa las solicitudes", () => {
  assert.equal(puedeRevisar({ rol: "administrador" }), true);
  assert.equal(puedeRevisar({ rol: "asociacion" }), false, "rol eliminado");
  assert.equal(puedeRevisar({ rol: "productor" }), false);
  assert.equal(puedeRevisar({ rol: "certificador" }), false);
  assert.deepEqual(filtroSolicitudes(), {});
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
