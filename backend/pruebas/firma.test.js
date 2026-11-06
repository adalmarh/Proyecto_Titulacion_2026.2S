// ==========================================================
// PRUEBAS DE LA FIRMA ELECTRÓNICA DEL CERTIFICADO PDF
// Usa un PDF generado por el sistema y firmado con un
// certificado de PRUEBA (fixtures/certificado-firmado-prueba.pdf).
// No necesitan MongoDB.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const generarCertificadoPDF = require("../utils/generarCertificadoPDF");
const {
  analizarFirmaPdf,
  perteneceACertificacion,
  nombreCoincide
} = require("../utils/firmaPdf");

const FIRMADO = fs.readFileSync(path.join(__dirname, "fixtures", "certificado-firmado-prueba.pdf"));
const CERT = { _id: "6650aa11bb22cc33dd44ee55", codigo: "CERT-2026-00001" };

const certificacionEjemplo = {
  ...CERT,
  tipoCertificacion: "Producción Orgánica",
  estado: "aprobada",
  fechaEmision: "2026-10-30",
  fechaVencimiento: "2027-10-30",
  certificador: { nombre: "Carla", apellido: "Montesdeoca" },
  lote: {
    codigo: "LOT-2026-0001",
    producto: "Cacao fino de aroma",
    cantidad: 1200,
    unidad: "kg",
    productor: { nombre: "Pedro", apellido: "Alcívar" },
    ubicacion: { provincia: "Los Ríos", canton: "Quevedo" }
  }
};


test("el PDF generado incluye el identificador de la certificación y no está firmado", async () => {
  const pdf = await generarCertificadoPDF(certificacionEjemplo, {
    urlVerificacion: "http://localhost:5173/verificar/abc123def456"
  });

  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(perteneceACertificacion(pdf, CERT));
  assert.ok(!perteneceACertificacion(pdf, { _id: "000000000000000000000000", codigo: "CERT-2026-00999" }));

  const r = analizarFirmaPdf(pdf);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /no tiene una firma/);
});

test("un PDF firmado correctamente se acepta y se lee quién lo firmó", () => {
  const r = analizarFirmaPdf(FIRMADO);

  assert.equal(r.ok, true);
  assert.equal(r.firma.firmante, "CARLA MONTESDEOCA");
  assert.equal(r.firma.identificacion, "0912345675");
  assert.equal(r.firma.algoritmo, "sha256");
  assert.equal(r.firma.integridad, true);
  assert.equal(r.firma.cubreTodo, true);
  assert.ok(r.firma.fechaFirma instanceof Date);
  assert.ok(perteneceACertificacion(FIRMADO, CERT));
});

test("si se cambia el contenido después de firmar, se detecta", () => {
  const alterado = Buffer.from(FIRMADO);
  const pos = alterado.indexOf("RutaCacao CERT");
  alterado[pos + 14] = "X".charCodeAt(0);

  const r = analizarFirmaPdf(alterado);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /alterado/);
});

test("si se agrega contenido después de la firma, se detecta", () => {
  const agregado = Buffer.concat([FIRMADO, Buffer.from("\n99 0 obj\n<< >>\nendobj\n%%EOF\n")]);

  const r = analizarFirmaPdf(agregado);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /modificado después de firmarlo/);
});

test("archivos que no son PDF se rechazan", () => {
  assert.equal(analizarFirmaPdf(Buffer.from("hola")).ok, false);
  assert.equal(analizarFirmaPdf(null).ok, false);
});

test("el nombre del firmante se compara sin tildes ni mayúsculas", () => {
  assert.equal(nombreCoincide("CARLA MONTESDEOCA", { nombre: "Carla", apellido: "Montesdeoca" }), true);
  assert.equal(nombreCoincide("JOSÉ LUIS PÉREZ MORA", { nombre: "José Luis", apellido: "Pérez" }), true);
  assert.equal(nombreCoincide("ANA VERA", { nombre: "Carla", apellido: "Montesdeoca" }), false);
});
