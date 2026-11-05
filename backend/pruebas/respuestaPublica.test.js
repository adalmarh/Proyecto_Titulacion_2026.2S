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
  },
  asociacion: {
    nombre: "Asociación Cacao Arriba",
    provincia: "Los Ríos",
    canton: "Quevedo",
    ruc: "1790011223001",
    email: "info@asociacion.ec"
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
       responsable: { nombre: "Ana", apellido: "Vera", rol: "asociacion", email: "ana@correo.com" } }]
  );
  const texto = JSON.stringify(r);

  for (const privado of ["1204567890", "0991112233", "pedro@correo.com",
    "carla@correo.com", "ana@correo.com", "id-interno", "secreto", "1790011223001"]) {
    assert.ok(!texto.includes(privado), `se publicó ${privado}`);
  }

  assert.deepEqual(r.productor, { nombre: "Pedro", apellido: "Alcívar" });
  assert.equal(r.asociacion.canton, "Quevedo");
  assert.equal(r.trazabilidad.eventos[0].responsable.rol, "asociacion");
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
