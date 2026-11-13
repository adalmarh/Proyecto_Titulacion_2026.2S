// ==========================================================
// PRUEBAS DE LA NTE INEN 176:2021 (grado del cacao)
// (base de datos SIMULADA)
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluarAnalisis } = require("../utils/normaInen176");
const Certificacion = require("../models/Certificacion");
const { aprobarCertificacion } = require("../controllers/certificacionController");
const generarCertificadoPDF = require("../utils/generarCertificadoPDF");

// Muestra que cumple el Grado 1 en todo
const grado1 = () => ({
  humedad: 6.5, peso100Granos: 135, bienFermentados: 80, violetas: 10, pizarrosos: 5,
  mohosos: 0.5, defectuosos: 0.3, materialRelacionado: 0.5, materiaExtrana: 0.2,
  sinHumo: true, sinInfestacion: true
});

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};


test("una muestra dentro de todos los límites del Grado 1 es Grado 1", () => {
  const r = evaluarAnalisis(grado1());
  assert.equal(r.cumple, true);
  assert.equal(r.grado, 1);
  assert.equal(r.norma, "NTE INEN 176:2021");
});

test("el grado del lote es el del peor parámetro", () => {
  assert.equal(evaluarAnalisis({ ...grado1(), bienFermentados: 70 }).grado, 2);
  assert.equal(evaluarAnalisis({ ...grado1(), mohosos: 3.5 }).grado, 3);
  assert.equal(evaluarAnalisis({ ...grado1(), peso100Granos: 130 }).grado, 2, "130 g no es «más de 130»");
  assert.equal(evaluarAnalisis({ ...grado1(), peso100Granos: 120 }).grado, 3);
  assert.equal(evaluarAnalisis({ ...grado1(), violetas: "15,0" }).grado, 1, "acepta coma decimal");
});

test("fuera del Grado 3, con humo o infestado: no cumple", () => {
  for (const cambio of [{ humedad: 7.5 }, { bienFermentados: 50 }, { peso100Granos: 95 }, { materiaExtrana: 0.8 }, { sinHumo: false }, { sinInfestacion: false }]) {
    const r = evaluarAnalisis({ ...grado1(), ...cambio });
    assert.equal(r.cumple, false, JSON.stringify(cambio));
    assert.equal(r.grado, null);
    assert.ok(r.motivos.length >= 1);
  }
});

test("rechaza valores vacíos, negativos o porcentajes mayores que 100", () => {
  assert.throws(() => evaluarAnalisis(undefined), /Falta el análisis/);
  assert.throws(() => evaluarAnalisis({ ...grado1(), humedad: "" }), /Humedad/);
  assert.throws(() => evaluarAnalisis({ ...grado1(), violetas: -1 }), /violetas/);
  assert.throws(() => evaluarAnalisis({ ...grado1(), bienFermentados: 120 }), /100 %/);
});

test("aprobar exige el análisis y guarda el grado calculado por el backend", async () => {
  let guardada;
  const cert = {
    _id: "c1", estado: "en_revision", certificador: "u1",
    datos: {},
    set(ruta, valor) { this.datos[ruta] = valor; },
    save: async function () { guardada = this; }
  };
  Certificacion.findById = (id) => {
    if (guardada) {
      const q = { populate: () => q, then: (ok) => ok(guardada) };
      return q;
    }
    return Promise.resolve(cert);
  };

  const usuario = { rol: "certificador", _id: "u1" };
  const vence = new Date(Date.now() + 86400000 * 365).toISOString();

  const sinAnalisis = respuesta();
  await aprobarCertificacion({ params: { id: "c1" }, usuario, body: { fechaVencimiento: vence } }, sinAnalisis);
  assert.equal(sinAnalisis.estado, 400);
  assert.match(sinAnalisis.datos.mensaje, /NTE INEN 176/);

  const noCumple = respuesta();
  await aprobarCertificacion({ params: { id: "c1" }, usuario, body: { fechaVencimiento: vence, analisisInen: { ...grado1(), humedad: 9 } } }, noCumple);
  assert.equal(noCumple.estado, 400);
  assert.match(noCumple.datos.mensaje, /no cumple/);
  assert.equal(cert.estado, "en_revision");

  const ok = respuesta();
  await aprobarCertificacion({ params: { id: "c1" }, usuario, body: { fechaVencimiento: vence, analisisInen: { ...grado1(), grado: 1, pizarrosos: 11 } } }, ok);
  assert.equal(ok.estado, 200, ok.datos?.mensaje);
  assert.equal(cert.estado, "aprobada");
  assert.equal(cert.datos["datosCertificacion.analisisInen"].grado, 2, "el grado lo calcula el backend");
});

test("el PDF con análisis tiene el anexo técnico con el enlace a la norma", async () => {
  const analisis = { ...grado1(), norma: "NTE INEN 176:2021", grado: 1, fechaAnalisis: new Date() };
  const pdf = await generarCertificadoPDF(
    { _id: "c1", codigo: "CERT-2026-00001", tipoCertificacion: "Calidad", datosCertificacion: { analisisInen: analisis }, lote: {} },
    { urlVerificacion: "http://x/verificar/abc" }
  );
  const texto = pdf.toString("latin1");
  assert.match(texto, /\/Count 2/, "dos páginas");
  assert.match(texto, /http:\/\/x\/normativa\/inen-176/, "enlace a la norma");

  const sinAnalisis = await generarCertificadoPDF(
    { _id: "c2", codigo: "CERT-2026-00002", tipoCertificacion: "Calidad", lote: {} },
    { urlVerificacion: "http://x/verificar/abc" }
  );
  assert.match(sinAnalisis.toString("latin1"), /\/Count 1/, "certificados antiguos: una página");
});
