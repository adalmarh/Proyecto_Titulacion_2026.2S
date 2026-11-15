// ==========================================================
// PRUEBAS DEL ASISTENTE DE IA (redacción del dictamen)
// El servicio de Gemini y la base de datos están SIMULADOS:
// estas pruebas no usan internet ni gastan consultas.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const ia = require("../utils/asistenteIA");
const { evaluarAnalisis } = require("../utils/normaInen176");
const Certificacion = require("../models/Certificacion");
const Lote = require("../models/Lote");
const { sugerirDictamenIA } = require("../controllers/certificacionController");

const analisis = () => ({
  humedad: 6.8, peso100Granos: 132, bienFermentados: 78, violetas: 14, pizarrosos: 5,
  mohosos: 1.5, defectuosos: 0.4, materialRelacionado: 0.5, materiaExtrana: 0.3,
  sinHumo: true, sinInfestacion: true
});

const respuestaGemini = (texto, estado = 200) => ({
  ok: estado === 200,
  status: estado,
  json: async () => (estado === 200
    ? { candidates: [{ content: { parts: [{ text: texto }] } }] }
    : { error: { message: "detalle del servicio" } })
});

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};

process.env.GEMINI_API_KEY = "clave-de-prueba";


test("la consulta solo lleva datos técnicos, nunca nombres ni ubicaciones", () => {
  const consulta = ia.construirConsulta({
    evaluacion: evaluarAnalisis(analisis()),
    decision: "aprobar",
    tipoCertificacion: "Calidad del Producto",
    estadoGrano: "seco"
  });
  assert.match(consulta, /Granos mohosos: 1,5 % → Grado 2/);
  assert.match(consulta, /CUMPLE, Grado 2/);
  assert.match(consulta, /APROBAR/);
  for (const prohibido of ["Anthony", "Mera", "cédula", "@", "Guayas"]) {
    assert.ok(!consulta.includes(prohibido), prohibido);
  }
});

test("lee la propuesta y respeta el largo máximo del resultado", () => {
  const largo = "Visita a finca el 10 de noviembre con toma de muestra representativa de cinco sacos.";
  const r = ia.leerRespuesta({ candidates: [{ content: { parts: [{ text: JSON.stringify({ resultado: largo, observaciones: "Texto." }) }] } }] });
  assert.ok(r.resultado.length <= ia.MAX_RESULTADO, r.resultado);
  assert.ok(!r.resultado.endsWith(" "));
  assert.equal(r.observaciones, "Texto.");

  const conBloque = ia.leerRespuesta({ candidates: [{ content: { parts: [{ text: '```json\n{"resultado":"Muestra conforme.","observaciones":"Bien."}\n```' }] } }] });
  assert.equal(conBloque.resultado, "Muestra conforme", "sin punto final");

  assert.throws(() => ia.leerRespuesta({ candidates: [] }), /no devolvió/);
  assert.throws(() => ia.leerRespuesta({ candidates: [{ content: { parts: [{ text: "no es json" }] } }] }), /no se pudo leer/);
});

test("envía la clave en la cabecera, pide JSON y usa el modelo configurable", async () => {
  let pedido;
  ia.cliente.fetch = async (url, opciones) => {
    pedido = { url, opciones, cuerpo: JSON.parse(opciones.body) };
    return respuestaGemini(JSON.stringify({ resultado: "Muestra conforme", observaciones: "Cumple el Grado 2." }));
  };

  const r = await ia.sugerirDictamen({ evaluacion: evaluarAnalisis(analisis()), decision: "aprobar" });
  assert.equal(r.resultado, "Muestra conforme");
  assert.match(pedido.url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(pedido.opciones.headers["x-goog-api-key"], "clave-de-prueba");
  assert.ok(!pedido.url.includes("clave-de-prueba"), "la clave no va en la URL");
  assert.equal(pedido.cuerpo.generationConfig.responseMimeType, "application/json");
  assert.match(pedido.cuerpo.systemInstruction.parts[0].text, /No cambies ni discutas el grado/);

  process.env.GEMINI_MODELO = "otro-modelo";
  await ia.sugerirDictamen({ evaluacion: evaluarAnalisis(analisis()), decision: "aprobar" });
  assert.match(pedido.url, /models\/otro-modelo:/);
  delete process.env.GEMINI_MODELO;
});

test("errores del servicio: mensajes claros para el certificador", async () => {
  const original = console.error;
  console.error = () => {};
  const casos = [[429, 429, /límite gratuito/], [403, 502, /clave o el modelo/], [404, 502, /no existe/], [500, 502, /no está disponible/]];
  for (const [codigo, esperado, mensaje] of casos) {
    ia.cliente.fetch = async () => respuestaGemini("", codigo);
    await assert.rejects(ia.sugerirDictamen({ evaluacion: evaluarAnalisis(analisis()), decision: "aprobar" }),
      (e) => e.estado === esperado && mensaje.test(e.message));
  }
  ia.cliente.fetch = async () => { const e = new Error("tiempo"); e.name = "TimeoutError"; throw e; };
  await assert.rejects(ia.sugerirDictamen({ evaluacion: evaluarAnalisis(analisis()), decision: "aprobar" }), /tardó demasiado/);
  console.error = original;

  delete process.env.GEMINI_API_KEY;
  await assert.rejects(ia.sugerirDictamen({ evaluacion: evaluarAnalisis(analisis()), decision: "aprobar" }), (e) => e.estado === 503);
  process.env.GEMINI_API_KEY = "clave-de-prueba";
});

test("la ruta: permisos, estado, análisis completo y el grado lo pone la norma", async () => {
  ia.cliente.fetch = async () => respuestaGemini(JSON.stringify({ resultado: "Muestra conforme", observaciones: "Grado 2." }));
  const cert = { _id: "c1", estado: "en_revision", certificador: "u1", lote: "l1", tipoCertificacion: "Calidad" };
  Certificacion.findById = async () => cert;
  Lote.findById = () => ({ select: async () => ({ estadoGrano: "seco" }) });

  const pedir = async (usuario, body) => { const res = respuesta(); await sugerirDictamenIA({ params: { id: "c1" }, usuario, body }, res); return res; };
  const certificador = { rol: "certificador", _id: "u1" };

  assert.equal((await pedir({ rol: "certificador", _id: "otro" }, { decision: "aprobar", analisisInen: analisis() })).estado, 403);
  assert.equal((await pedir(certificador, { decision: "quizas", analisisInen: analisis() })).estado, 400);
  assert.equal((await pedir(certificador, { decision: "aprobar", analisisInen: { ...analisis(), humedad: "" } })).estado, 400);

  const ok = await pedir(certificador, { decision: "aprobar", analisisInen: analisis() });
  assert.equal(ok.estado, 200, ok.datos?.mensaje);
  assert.equal(ok.datos.grado, 2);
  assert.equal(ok.datos.resultado, "Muestra conforme");
  assert.match(ok.datos.aviso, /Revísala/);

  cert.estado = "aprobada";
  assert.equal((await pedir(certificador, { decision: "aprobar", analisisInen: analisis() })).estado, 400);
});
