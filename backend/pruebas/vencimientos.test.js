// ==========================================================
// PRUEBAS DEL VENCIMIENTO DE CERTIFICACIONES
// (base de datos SIMULADA)
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const Certificacion = require("../models/Certificacion");
const {
  DIAS_AVISO,
  diasParaVencer,
  filtroPorVencer,
  marcarCertificacionesVencidas
} = require("../utils/vencimientos");
const {
  aprobarCertificacion,
  obtenerAvisosVencimiento
} = require("../controllers/certificacionController");

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-11-07T15:00:00Z");

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  res.setHeader = () => res;
  res.send = (d) => { res.datos = d; return res; };
  return res;
};


test("días que faltan para vencer", () => {
  assert.equal(diasParaVencer(new Date(AHORA.getTime() + 10 * DIA), AHORA), 10);
  assert.equal(diasParaVencer(new Date(AHORA.getTime() + 2 * 60 * 60 * 1000), AHORA), 1, "vence en unas horas: 1 día");
  assert.equal(diasParaVencer(new Date(AHORA.getTime() - 3 * DIA), AHORA), -3);
  assert.equal(diasParaVencer(null, AHORA), null);
});

test("el aviso cubre las aprobadas de los próximos 30 días", () => {
  const f = filtroPorVencer(AHORA);
  assert.equal(DIAS_AVISO, 30);
  assert.equal(f.estado, "aprobada");
  assert.equal(f.fechaVencimiento.$gte.getTime(), AHORA.getTime());
  assert.equal(f.fechaVencimiento.$lte.getTime(), AHORA.getTime() + 30 * DIA);
});

test("marca como vencidas solo las aprobadas con fecha pasada", async () => {
  let consulta;
  Certificacion.updateMany = async (filtro, cambio) => {
    consulta = { filtro, cambio };
    return { modifiedCount: 2 };
  };

  assert.equal(await marcarCertificacionesVencidas(AHORA), 2);
  assert.equal(consulta.filtro.estado, "aprobada");
  assert.equal(consulta.filtro.fechaVencimiento.$lt.getTime(), AHORA.getTime());
  assert.deepEqual(consulta.cambio, { $set: { estado: "vencida" } });
});

test("no se aprueba con una fecha de vencimiento pasada", async () => {
  let guardada = false;
  const cert = {
    _id: "c1",
    estado: "en_revision",
    certificador: { toString: () => "u-cert" },
    save: async () => { guardada = true; }
  };
  Certificacion.findById = () => Promise.resolve(cert);

  const res = respuesta();
  await aprobarCertificacion({
    params: { id: "c1" },
    usuario: { _id: "u-cert", rol: "certificador" },
    body: { fechaVencimiento: "2020-01-01" }
  }, res);

  assert.equal(res.estado, 400);
  assert.match(res.datos.mensaje, /posterior a hoy/);
  assert.equal(guardada, false);
});

test("los avisos devuelven las que vencen pronto y las vencidas recientes", async () => {
  const futura = new Date(Date.now() + 12 * DIA);
  const pasada = new Date(Date.now() - 5 * DIA);
  const datos = {
    aprobada: [{ _id: "c1", codigo: "CERT-1", tipoCertificacion: "Orgánica", estado: "aprobada", fechaVencimiento: futura, lote: { _id: "l1", codigo: "LOT-1", productor: { nombre: "Pedro", apellido: "A", cedula: "0900000001" } }, certificador: { nombre: "Carla", apellido: "M", email: "carla@x.ec" } }],
    vencida: [{ _id: "c2", codigo: "CERT-2", tipoCertificacion: "Comercio Justo", estado: "vencida", fechaVencimiento: pasada, lote: null, certificador: null }]
  };

  Certificacion.updateMany = async () => ({ modifiedCount: 0 });
  Certificacion.find = (q) => {
    const estado = q.$and[0].estado;
    const cadena = {
      select: () => cadena,
      populate: () => cadena,
      sort: () => cadena,
      limit: async () => datos[estado]
    };
    return cadena;
  };

  const res = respuesta();
  await obtenerAvisosVencimiento({ usuario: { _id: "u1", rol: "administrador" } }, res);

  assert.equal(res.estado, 200, res.datos?.mensaje);
  assert.equal(res.datos.dias, 30);
  assert.equal(res.datos.porVencer[0].codigo, "CERT-1");
  assert.equal(res.datos.porVencer[0].diasParaVencer, 12);
  assert.equal(res.datos.porVencer[0].lote.productor.nombre, "Pedro");
  assert.ok(!JSON.stringify(res.datos).includes("0900000001"), "no expone la cédula");
  assert.ok(!JSON.stringify(res.datos).includes("carla@x.ec"), "no expone correos");
  assert.equal(res.datos.vencidas[0].diasParaVencer, -5);
});
