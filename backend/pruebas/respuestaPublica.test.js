// ==========================================================
// PRUEBAS DE LA CONSULTA PÚBLICA DEL QR
// Comprueban qué información ve el consumidor final.
// Ejecutar desde la carpeta backend:  npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const { armarRespuestaPublica } = require("../utils/respuestaPublica");

const AHORA = new Date("2026-10-20T12:00:00Z");

const loteBase = {
  _id: "id-interno",
  codigo: "LOT-2026-0001",
  producto: "Cacao fino de aroma",
  cantidad: 1200,
  unidad: "kg",
  estado: "cosechado",
  activo: true,
  productor: {
    nombre: "Pedro",
    apellido: "Alcívar",
    cedula: "1204567890",
    telefono: "0991112233",
    email: "pedro@correo.com"
  }
};

const cert = (datos) => ({
  tipoCertificacion: "Orgánica",
  certificador: { nombre: "Carla", apellido: "Mora", email: "carla@correo.com" },
  ...datos
});

const armar = (certificaciones = [], eventos = []) =>
  armarRespuestaPublica({
    lote: loteBase,
    eventos,
    certificaciones,
    codigoQR: { token: "secreto", totalEscaneos: 5 },
    ahora: AHORA
  });


test("no publica datos personales ni identificadores internos", () => {
  const r = armar(
    [cert({ estado: "aprobada", fechaEmision: "2026-09-01", fechaVencimiento: "2027-09-01" })],
    [{ tipo: "cosecha", descripcion: "Cosecha", fecha: "2026-10-01",
       responsable: { nombre: "Ana", apellido: "Vera", rol: "administrador", email: "ana@correo.com" } }]
  );
  const texto = JSON.stringify(r);

  for (const privado of ["1204567890", "0991112233", "pedro@correo.com",
    "carla@correo.com", "ana@correo.com", "id-interno", "secreto"]) {
    assert.ok(!texto.includes(privado), `se publicó ${privado}`);
  }

  assert.deepEqual(r.productor, { nombre: "Pedro", apellido: "Alcívar" });
  assert.equal(r.empresa.nombre, "Cacaotera Aroma del Litoral S.A.", "muestra la empresa");
  assert.equal(r.asociacion, undefined, "ya no hay asociación");
  assert.equal(r.trazabilidad.eventos[0].responsable.rol, "administrador");
});

test("certificación aprobada y no vencida: vigente", () => {
  const r = armar([cert({ estado: "aprobada", fechaEmision: "2026-09-01", fechaVencimiento: "2027-09-01" })]);
  assert.equal(r.certificacion.estado, "vigente");
  assert.equal(r.certificacion.vigente.tipoCertificacion, "Orgánica");
  assert.deepEqual(r.certificacion.vigente.certificador, { nombre: "Carla", apellido: "Mora" });
});

test("certificación aprobada pero vencida: no se muestra como vigente", () => {
  const r = armar([cert({ estado: "aprobada", fechaEmision: "2025-01-01", fechaVencimiento: "2026-01-01" })]);
  assert.equal(r.certificacion.estado, "vencida");
  assert.equal(r.certificacion.vigente, null);
  assert.equal(r.certificaciones[0].vigente, false);
});

test("solicitud en trámite y rechazadas: no se publican sus detalles", () => {
  const r = armar([
    cert({ estado: "en_revision" }),
    cert({ estado: "rechazada", observaciones: "Motivo interno del rechazo" })
  ]);
  assert.equal(r.certificacion.estado, "en_tramite");
  assert.equal(r.certificaciones.length, 0);
  assert.ok(!JSON.stringify(r).includes("Motivo interno"));
});

test("sin certificaciones", () => {
  const r = armar();
  assert.equal(r.certificacion.estado, "sin_certificacion");
  assert.equal(r.qr.totalEscaneos, 5);
});

test("los datos de la empresa se configuran en el .env", () => {
  const { datosEmpresa } = require("../utils/empresa");
  const antes = { ...process.env };
  try {
    delete process.env.EMPRESA_NOMBRE;
    assert.equal(datosEmpresa().nombre, "Cacaotera Aroma del Litoral S.A.", "nombre por defecto");
    process.env.EMPRESA_NOMBRE = "  Cacao del Valle S.A.  ";
    process.env.EMPRESA_RUC = "0990000000001";
    process.env.EMPRESA_CIUDAD = "Milagro";
    assert.deepEqual(datosEmpresa(), { nombre: "Cacao del Valle S.A.", ruc: "0990000000001", ciudad: "Milagro" });
  } finally {
    process.env = antes;
  }
});
