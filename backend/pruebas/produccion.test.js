// ==========================================================
// PRUEBAS DE LOS AJUSTES DE PRODUCCIÓN
// (CORS y errores internos ocultos)
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  origenesPermitidos,
  ocultarErroresInternos
} = require("../middleware/produccionMiddleware");

const respuesta = () => {
  const res = { statusCode: 200, enviado: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (d) => { res.enviado = d; return res; };
  return res;
};

const preguntar = (opciones, origen) =>
  new Promise((ok) => opciones.origin(origen, (_e, permitido) => ok(permitido)));


test("CORS: sin CORS_ORIGINS se permite todo (desarrollo)", () => {
  delete process.env.CORS_ORIGINS;
  assert.deepEqual(origenesPermitidos(), {});
});

test("CORS: solo la dirección del frontend publicado", async () => {
  process.env.CORS_ORIGINS = "https://rutacacao.onrender.com/, https://otra.ec";
  const opciones = origenesPermitidos();
  assert.equal(await preguntar(opciones, "https://rutacacao.onrender.com"), true);
  assert.equal(await preguntar(opciones, "https://otra.ec"), true);
  assert.equal(await preguntar(opciones, "https://sitio-malicioso.com"), false);
  assert.equal(await preguntar(opciones, undefined), true, "Postman o el ping de salud");
  delete process.env.CORS_ORIGINS;
});

test("en producción los errores 500 no envían el detalle técnico", () => {
  process.env.NODE_ENV = "production";
  const original = console.error;
  const registrados = [];
  console.error = (...a) => registrados.push(a.join(" "));

  const res = respuesta();
  ocultarErroresInternos({ method: "GET", originalUrl: "/api/lotes" }, res, () => {});
  res.status(500).json({ mensaje: "Error al obtener los lotes", error: "MongoServerError: conexión rechazada" });
  assert.deepEqual(res.enviado, { mensaje: "Error al obtener los lotes" });
  assert.match(registrados.join(), /MongoServerError/, "el detalle queda en el registro");

  const res400 = respuesta();
  ocultarErroresInternos({ method: "POST", originalUrl: "/api/lotes" }, res400, () => {});
  res400.status(400).json({ mensaje: "Falta el productor", error: "detalle" });
  assert.equal(res400.enviado.error, "detalle", "los errores 400 no cambian");

  console.error = original;
  delete process.env.NODE_ENV;
});

test("en desarrollo no se cambia nada", () => {
  delete process.env.NODE_ENV;
  const res = respuesta();
  ocultarErroresInternos({}, res, () => {});
  res.status(500).json({ mensaje: "x", error: "detalle" });
  assert.equal(res.enviado.error, "detalle");
});
