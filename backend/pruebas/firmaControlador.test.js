// ==========================================================
// PRUEBAS DEL CONTROLADOR DE FIRMA (base de datos SIMULADA)
// Subir el certificado firmado (a mano y escaneado, o con
// firma electrónica), descargarlo y verificarlo en la
// página pública, sin MongoDB.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const Certificacion = require("../models/Certificacion");
const CertificadoFirmado = require("../models/CertificadoFirmado");
const generarCertificadoPDF = require("../utils/generarCertificadoPDF");
const PDFDocument = require("pdfkit");
const { firmarPdfPrueba } = require("../scripts/firmarPdfPrueba");
const {
  subirCertificadoFirmado,
  verificarCertificadoPublico,
  descargarCertificadoPDF
} = require("../controllers/certificacionController");

const ID_CERTIFICADOR = "64b0000000000000000000c1";
const OTRO_CERTIFICADOR = "64b0000000000000000000c2";

// ---------- Datos simulados ----------
const nuevaCertificacion = () => ({
  _id: "64b0000000000000000000aa",
  codigo: "CERT-2026-00007",
  codigoVerificacion: "Xk3p9QmZ2tLw",
  tipoCertificacion: "Producción Orgánica",
  estado: "aprobada",
  activo: true,
  fechaEmision: new Date("2026-10-30"),
  fechaVencimiento: new Date(Date.now() + 365 * 864e5),
  certificador: { _id: ID_CERTIFICADOR, nombre: "Carla", apellido: "Montesdeoca" },
  lote: {
    codigo: "LOT-2026-0001",
    producto: "Cacao fino de aroma",
    cantidad: 1200,
    unidad: "kg",
    ubicacion: { provincia: "Los Ríos", canton: "Quevedo" },
    productor: { nombre: "Pedro", apellido: "Alcívar", cedula: "0900000001", email: "pedro@finca.ec" },
    ubicacion: { provincia: "Los Ríos", canton: "Quevedo" }
  },
  firma: { firmada: false },
  async save() { return this; }
});

let actual;
let guardado = null;

const consulta = (valor) => {
  const q = { populate: () => q, then: (ok, mal) => Promise.resolve(valor()).then(ok, mal) };
  return q;
};

Certificacion.findById = () => consulta(() => actual);
Certificacion.findOne = (filtro) => consulta(() =>
  actual && filtro.codigoVerificacion === actual.codigoVerificacion ? actual : null);
Certificacion.updateOne = async () => ({});
CertificadoFirmado.findOneAndUpdate = async (filtro, datos) => { guardado = datos; return datos; };
CertificadoFirmado.findOne = async () => guardado;

const respuesta = () => {
  const res = { estado: 200, cabeceras: {} };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  res.send = (d) => { res.datos = d; return res; };
  res.setHeader = (k, v) => { res.cabeceras[k] = v; };
  return res;
};

const pedir = async (fn, { usuario, body, params = {}, query = {} }) => {
  const res = respuesta();
  await fn({ usuario, body, params: { id: "64b0000000000000000000aa", ...params }, query }, res);
  return res;
};

const certificador = { _id: ID_CERTIFICADOR, rol: "certificador" };
const CONFIRMO = { confirmo: "si" };

// PDF como el que sale de un escáner: otro archivo, sin los
// metadatos del original y sin firma electrónica.
const pdfEscaneado = () => new Promise((ok) => {
  const doc = new PDFDocument();
  const partes = [];
  doc.on("data", (p) => partes.push(p));
  doc.on("end", () => ok(Buffer.concat(partes)));
  doc.text("Certificado escaneado con firma manuscrita");
  doc.end();
});


test("firma manuscrita: descargar, firmar a mano, escanear, confirmar y subir", async () => {
  actual = nuevaCertificacion();
  guardado = null;

  // 1. Descargar el original
  const descarga = await pedir(descargarCertificadoPDF, { usuario: certificador, query: { version: "original" } });
  assert.equal(descarga.cabeceras["Content-Type"], "application/pdf");
  assert.ok(descarga.datos.includes("CERT-2026-00007"));

  const escaneado = await pdfEscaneado();

  // 2. Sin confirmar que está firmado → rechazado
  const sinConfirmar = await pedir(subirCertificadoFirmado, { usuario: certificador, body: escaneado });
  assert.equal(sinConfirmar.estado, 400);
  assert.match(sinConfirmar.datos.mensaje, /[Cc]onfirma/);

  // 3. Confirmado → se guarda como firma manuscrita del certificador
  const subida = await pedir(subirCertificadoFirmado, { usuario: certificador, body: escaneado, query: CONFIRMO });
  assert.equal(subida.estado, 200, subida.datos?.mensaje);
  assert.equal(subida.datos.firma.firmada, true);
  assert.equal(subida.datos.firma.tipo, "manuscrita");
  assert.equal(subida.datos.firma.firmante, "Carla Montesdeoca");
  assert.deepEqual(subida.datos.advertencias, []);
  assert.equal(guardado.sha256, crypto.createHash("sha256").update(escaneado).digest("hex"));

  // 4. La descarga entrega ahora el escaneado
  const otra = await pedir(descargarCertificadoPDF, { usuario: certificador });
  assert.ok(Buffer.from(otra.datos).equals(escaneado));

  // 5. Verificación pública
  const v = await pedir(verificarCertificadoPublico, { params: { codigo: "Xk3p9QmZ2tLw" } });
  assert.equal(v.estado, 200);
  assert.equal(v.datos.estado, "vigente");
  assert.equal(v.datos.firma.firmada, true);
  assert.equal(v.datos.firma.tipo, "manuscrita");
  assert.equal(v.datos.firma.sha256, guardado.sha256);
  const texto = JSON.stringify(v.datos);
  assert.ok(!texto.includes("0900000001") && !texto.includes("pedro@finca.ec"), "sin datos personales");
});

test("firma electrónica (opcional): se reconoce si el PDF la trae", async () => {
  actual = nuevaCertificacion();
  guardado = null;
  const original = await generarCertificadoPDF(actual, { urlVerificacion: "http://x/verificar/Xk3p9QmZ2tLw" });
  const firmado = firmarPdfPrueba(original);

  const subida = await pedir(subirCertificadoFirmado, { usuario: certificador, body: firmado, query: CONFIRMO });
  assert.equal(subida.estado, 200, subida.datos?.mensaje);
  assert.equal(subida.datos.firma.tipo, "electronica");
  assert.equal(subida.datos.firma.firmante, "CARLA MONTESDEOCA");
  assert.ok(subida.datos.advertencias.some((a) => /prueba/.test(a)), "avisa que el certificado es de prueba");
  assert.ok(!subida.datos.advertencias.some((a) => /no coincide/.test(a)), "el nombre sí coincide");

  const v = await pedir(verificarCertificadoPublico, { params: { codigo: "Xk3p9QmZ2tLw" } });
  assert.equal(v.datos.firma.tipo, "electronica");
});

test("una firma electrónica alterada se registra como manuscrita, con aviso", async () => {
  actual = nuevaCertificacion();
  const firmado = firmarPdfPrueba(await generarCertificadoPDF(actual, { urlVerificacion: "http://x/v/1" }));
  const alterado = Buffer.concat([firmado, Buffer.from("\n% editado despues\n")]);
  const r = await pedir(subirCertificadoFirmado, { usuario: certificador, body: alterado, query: CONFIRMO });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.firma.tipo, "manuscrita");
  assert.ok(r.datos.advertencias.some((a) => /no es válida/.test(a)));
});

test("solo el certificador asignado sube la firma (ni otro certificador ni el administrador)", async () => {
  actual = nuevaCertificacion();
  const pdf = await pdfEscaneado();

  const otro = await pedir(subirCertificadoFirmado, { usuario: { _id: OTRO_CERTIFICADOR, rol: "certificador" }, body: pdf, query: CONFIRMO });
  assert.equal(otro.estado, 403);

  const admin = await pedir(subirCertificadoFirmado, { usuario: { _id: "64b0000000000000000000ad", rol: "administrador" }, body: pdf, query: CONFIRMO });
  assert.equal(admin.estado, 403);
});

test("rechaza archivos que no son PDF", async () => {
  actual = nuevaCertificacion();
  const r = await pedir(subirCertificadoFirmado, { usuario: certificador, body: Buffer.from("\xff\xd8\xff foto.jpg"), query: CONFIRMO });
  assert.equal(r.estado, 400);
  assert.match(r.datos.mensaje, /no es un PDF/);
});

test("no se firman certificaciones que no están aprobadas", async () => {
  actual = { ...nuevaCertificacion(), estado: "en_revision" };
  const pdf = firmarPdfPrueba(await generarCertificadoPDF(actual, { urlVerificacion: "http://x/v/1" }));
  const r = await pedir(subirCertificadoFirmado, { usuario: certificador, body: pdf, query: CONFIRMO });
  assert.equal(r.estado, 400);
});

test("avisa si quien firma no es el certificador asignado", async () => {
  actual = { ...nuevaCertificacion(), certificador: { _id: ID_CERTIFICADOR, nombre: "Luis", apellido: "Vera" } };
  const pdf = firmarPdfPrueba(await generarCertificadoPDF(actual, { urlVerificacion: "http://x/v/1" }));
  const r = await pedir(subirCertificadoFirmado, { usuario: certificador, body: pdf, query: CONFIRMO });
  assert.equal(r.estado, 200);
  assert.ok(r.datos.advertencias.some((a) => /no coincide/.test(a)));
});

test("verificación pública: códigos inválidos o certificaciones no aprobadas dan 404", async () => {
  actual = nuevaCertificacion();
  assert.equal((await pedir(verificarCertificadoPublico, { params: { codigo: "../../etc" } })).estado, 404);
  assert.equal((await pedir(verificarCertificadoPublico, { params: { codigo: "NoExiste12345" } })).estado, 404);

  actual = { ...nuevaCertificacion(), estado: "rechazada" };
  assert.equal((await pedir(verificarCertificadoPublico, { params: { codigo: "Xk3p9QmZ2tLw" } })).estado, 404);

  actual = { ...nuevaCertificacion(), fechaVencimiento: new Date("2020-01-01") };
  const vencido = await pedir(verificarCertificadoPublico, { params: { codigo: "Xk3p9QmZ2tLw" } });
  assert.equal(vencido.datos.estado, "vencido");
});
