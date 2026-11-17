// ==========================================================
// PRUEBAS DE LA FIRMA ELECTRÓNICA DEL SISTEMA
// (base de datos SIMULADA)
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

process.env.FIRMA_SECRETO = "secreto-de-prueba";

const F = require("../utils/firmaSistema");
const Certificacion = require("../models/Certificacion");
const Usuario = require("../models/Usuario");
const { firmarEnSistema } = require("../controllers/certificacionController");
const generarCertificadoPDF = require("../utils/generarCertificadoPDF");

const certificador = { _id: "u9", nombre: "John", apellido: "Cedeño" };

const certificado = () => ({
  _id: "c1",
  codigo: "CERT-2026-00003",
  codigoVerificacion: "Xk3p9QmZ2tLw",
  tipoCertificacion: "Calidad del Producto",
  estado: "aprobada",
  fechaEmision: new Date("2026-11-16"),
  fechaVencimiento: new Date("2027-11-16"),
  observaciones: "Lote homogéneo.",
  certificador: "u9",
  datosCertificacion: { resultadoInspeccion: "Muestra conforme", analisisInen: { norma: "NTE INEN 176:2021", grado: 2, humedad: 6.8 } },
  lote: { _id: "l4", codigo: "LOT-2026-0004", cantidad: 907.18, estadoGrano: "seco", productor: "p1" }
});

const firmado = () => {
  const c = certificado();
  c.firma = { ...F.firmarCertificacion(c, certificador, new Date("2026-11-16T21:05:00Z")), subidoPor: "u9" };
  return c;
};

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};


test("la huella no depende del orden de los datos", () => {
  assert.equal(F.jsonEstable({ b: 1, a: { d: 2, c: 3 } }), F.jsonEstable({ a: { c: 3, d: 2 }, b: 1 }));
});

test("una firma recién hecha es válida e íntegra", () => {
  const c = firmado();
  assert.equal(c.firma.tipo, "sistema");
  assert.equal(c.firma.firmante, "John Cedeño");
  assert.match(c.firma.sha256, /^[0-9a-f]{64}$/);
  assert.match(c.firma.codigoFirma, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  assert.deepEqual(F.verificarFirma(c), { aplica: true, valida: true, integra: true, codigoFirma: c.firma.codigoFirma });
});

test("si cambia un dato firmado, la firma deja de ser íntegra", () => {
  const cambios = [
    (c) => { c.observaciones = "Otro texto"; },
    (c) => { c.lote.cantidad = 1000; },
    (c) => { c.datosCertificacion.analisisInen.grado = 1; },
    (c) => { c.fechaVencimiento = new Date("2030-01-01"); }
  ];
  for (const cambiar of cambios) {
    const c = firmado();
    cambiar(c);
    const v = F.verificarFirma(c);
    assert.equal(v.valida, true, "el sello sigue siendo del sistema");
    assert.equal(v.integra, false, String(cambiar));
  }
});

test("el estado o la etapa del lote pueden cambiar sin romper la firma", () => {
  const c = firmado();
  c.estado = "vencida";
  c.lote.estado = "distribuido";
  assert.equal(F.verificarFirma(c).integra, true);
});

test("no se puede falsificar el sello sin la clave del servidor", () => {
  const c = firmado();
  c.firma.sello = "0".repeat(64);
  assert.equal(F.verificarFirma(c).valida, false);

  const otra = firmado();
  process.env.FIRMA_SECRETO = "otra-clave";
  assert.equal(F.verificarFirma(otra).valida, false);
  process.env.FIRMA_SECRETO = "secreto-de-prueba";
});

test("firmar en el sistema: solo el certificador asignado y con su contraseña", async () => {
  const hash = await bcrypt.hash("clave123", 4);
  let cert;
  Certificacion.findById = () => ({ populate: async () => cert });
  Usuario.findById = () => ({ select: async () => ({ ...certificador, password: hash }) });
  const firmar = async (usuario, body) => { const res = respuesta(); await firmarEnSistema({ params: { id: "c1" }, usuario, body }, res); return res; };
  const nuevo = () => ({ ...certificado(), save: async function () { return this; } });
  const yo = { rol: "certificador", _id: "u9" };

  cert = nuevo();
  assert.equal((await firmar({ rol: "certificador", _id: "otro" }, { password: "clave123", confirmo: true })).estado, 403);
  assert.equal((await firmar({ rol: "administrador", _id: "u1" }, { password: "clave123", confirmo: true })).estado, 403);
  assert.equal((await firmar(yo, { password: "clave123" })).estado, 400, "sin confirmar");

  cert = { ...nuevo(), estado: "en_revision" };
  assert.equal((await firmar(yo, { password: "clave123", confirmo: true })).estado, 400, "no aprobada");

  cert = nuevo();
  const mala = await firmar(yo, { password: "otra", confirmo: true });
  assert.equal(mala.estado, 400, "400: un 401 cerraría la sesión del certificador");
  assert.match(mala.datos.mensaje, /contraseña no es correcta/);
  assert.equal(cert.firma, undefined, "con contraseña incorrecta no se firma");

  const ok = await firmar(yo, { password: "clave123", confirmo: true });
  assert.equal(ok.estado, 200, ok.datos?.mensaje);
  assert.equal(cert.firma.tipo, "sistema");
  assert.equal(String(cert.firma.subidoPor), "u9");
  assert.equal(F.verificarFirma(cert).integra, true);

  assert.equal((await firmar(yo, { password: "clave123", confirmo: true })).estado, 400, "ya firmado");
});

test("demasiadas contraseñas incorrectas bloquean la firma por 15 minutos", async () => {
  const hash = await bcrypt.hash("clave123", 4);
  const cert = { ...certificado(), certificador: "u77", save: async () => {} };
  Certificacion.findById = () => ({ populate: async () => cert });
  Usuario.findById = () => ({ select: async () => ({ ...certificador, _id: "u77", password: hash }) });
  const usuario = { rol: "certificador", _id: "u77" };
  for (let i = 0; i < 5; i += 1) {
    const res = respuesta();
    await firmarEnSistema({ params: { id: "c1" }, usuario, body: { password: "mal", confirmo: true } }, res);
    assert.equal(res.estado, 400);
  }
  const bloqueado = respuesta();
  await firmarEnSistema({ params: { id: "c1" }, usuario, body: { password: "clave123", confirmo: true } }, bloqueado);
  assert.equal(bloqueado.estado, 429);
});

test("el PDF firmado en el sistema lleva el sello con el enlace de validación", async () => {
  const c = firmado();
  c.certificador = certificador;
  const pdf = (await generarCertificadoPDF(c, { urlVerificacion: "http://x/verificar/Xk3p9QmZ2tLw" })).toString("latin1");
  assert.ok(pdf.includes(`http://x/verificar/Xk3p9QmZ2tLw?firma=${c.firma.codigoFirma}`), "QR del sello con su enlace");
});
