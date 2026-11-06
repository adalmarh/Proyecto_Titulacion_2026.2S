// ==========================================================
// PRUEBAS DE INTEGRACIÓN DE LA API (semana 5)
// ----------------------------------------------------------
// Levanta el backend REAL (server.js) contra una base de
// datos de PRUEBAS, recorre el flujo completo con los cuatro
// roles y verifica permisos, validaciones y la consulta
// pública del QR. Al terminar genera un informe en
// pruebas/resultados/ y BORRA la base de pruebas.
//
// Requisito en backend/.env (una línea nueva):
//   MONGO_URI_PRUEBAS=mongodb://127.0.0.1:27017/agroseguro_pruebas
//
// Por seguridad, el nombre de la base DEBE contener "prueba"
// o "test"; si no, el script se detiene sin tocar nada.
// Nunca usa ni modifica la base de MONGO_URI.
//
// Ejecutar, desde la carpeta backend:
//   npm run test:integracion
//   npm run test:integracion -- --conservar   (no borra la base al final)
// ==========================================================

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const BACKEND = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(BACKEND, ".env"), quiet: true });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");
const { VERSION_AVISO_PRIVACIDAD } = require("../utils/privacidad");
const PDFDocument = require("pdfkit");
const { firmarPdfPrueba } = require("../scripts/firmarPdfPrueba");

const PUERTO = 5099;
const API = `http://localhost:${PUERTO}/api`;
const CONSERVAR = process.argv.includes("--conservar");
const URI = process.env.MONGO_URI_PRUEBAS;
const CLAVE = "Prueba2026";


// ==========================================================
// UTILIDADES
// ==========================================================

const resultados = [];
let grupoActual = "";

const grupo = (nombre) => {
  grupoActual = nombre;
  console.log(`\n${nombre}`);
};

// Registra un caso: id, descripción, resultado esperado y
// una función que devuelve { ok, obtenido }.
const caso = async (id, descripcion, esperado, fn) => {
  let ok = false;
  let obtenido = "";

  try {
    const r = await fn();
    ok = Boolean(r.ok);
    obtenido = r.obtenido;
  } catch (error) {
    obtenido = `Error: ${error.message}`;
  }

  resultados.push({ grupo: grupoActual, id, descripcion, esperado, obtenido, ok });
  console.log(`  ${ok ? "OK   " : "FALLA"} ${id}  ${descripcion}${ok ? "" : `  → ${obtenido}`}`);
};

// Petición HTTP a la API
const http = async (metodo, ruta, { token, body, pdf } = {}) => {
  const respuesta = await fetch(API + ruta, {
    method: metodo,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(pdf ? { "Content-Type": "application/pdf" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: pdf || (body ? JSON.stringify(body) : undefined)
  });

  const tipo = respuesta.headers.get("content-type") || "";
  const datos = tipo.includes("application/json")
    ? await respuesta.json()
    : await respuesta.arrayBuffer();

  return { status: respuesta.status, tipo, datos };
};

const lista = (datos, clave) => (Array.isArray(datos) ? datos : datos?.[clave] || []);
const ids = (arr) => arr.map((x) => String(x._id)).sort();
const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Verifica un código HTTP
const codigo = (r, esperado) => ({
  ok: r.status === esperado,
  obtenido: `${r.status}${r.datos?.mensaje ? ` · ${r.datos.mensaje}` : ""}`
});

const login = async (email) => {
  const r = await http("POST", "/auth/login", { body: { email, password: CLAVE } });
  if (r.status !== 200) {
    throw new Error(`No se pudo iniciar sesión con ${email}: ${r.status} ${r.datos?.mensaje || ""}`);
  }
  return r.datos.token;
};

// Crea un registro y devuelve el objeto creado
const crear = async (ruta, token, body, clave) => {
  const r = await http("POST", ruta, { token, body });
  if (r.status !== 201) {
    throw new Error(`POST ${ruta}: ${r.status} ${r.datos?.mensaje || ""}`);
  }
  return r.datos[clave];
};


// ==========================================================
// PREPARACIÓN: base de pruebas y servidor
// ==========================================================

const prepararBase = async () => {
  if (!URI) {
    console.error(
      "\nFalta la variable MONGO_URI_PRUEBAS en backend/.env\n" +
      "Agrega, por ejemplo:\n" +
      "  MONGO_URI_PRUEBAS=mongodb://127.0.0.1:27017/agroseguro_pruebas\n"
    );
    process.exit(1);
  }

  if (URI === process.env.MONGO_URI) {
    console.error("\nMONGO_URI_PRUEBAS no puede ser igual a MONGO_URI. No se tocó ninguna base.\n");
    process.exit(1);
  }

  await mongoose.connect(URI);
  const nombre = mongoose.connection.name || mongoose.connection.db.databaseName;

  if (!/prueba|test/i.test(nombre)) {
    console.error(
      `\nLa base "${nombre}" no parece de pruebas (su nombre debe contener "prueba" o "test").\n` +
      "Por seguridad no se modificó nada.\n"
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // Empieza siempre desde una base vacía
  await mongoose.connection.db.dropDatabase();

  await Usuario.create({
    nombre: "Admin",
    apellido: "Pruebas",
    email: "admin@pruebas.ec",
    password: await bcrypt.hash(CLAVE, await bcrypt.genSalt(10)),
    rol: "administrador"
  });

  return nombre;
};

const iniciarServidor = async () => {
  const salida = [];

  const servidor = spawn(process.execPath, ["server.js"], {
    cwd: BACKEND,
    env: {
      ...process.env,
      MONGO_URI: URI,
      PORT: String(PUERTO),
      LIMITE_SOLICITUDES: "100",
      QR_FRONTEND_URL: "http://localhost:5173"
    }
  });

  servidor.stdout.on("data", (d) => salida.push(String(d)));
  servidor.stderr.on("data", (d) => salida.push(String(d)));

  for (let i = 0; i < 40; i++) {
    await esperar(500);
    try {
      const r = await fetch(`http://localhost:${PUERTO}/`);
      if (r.ok && salida.join("").includes("MongoDB conectado")) {
        return servidor;
      }
    } catch {
      // aún no responde
    }
    if (servidor.exitCode !== null) break;
  }

  servidor.kill();
  throw new Error(`El servidor no arrancó:\n${salida.join("")}`);
};


// ==========================================================
// CASOS DE PRUEBA
// ==========================================================

const ejecutarCasos = async () => {

  const T = {};   // tokens
  const D = {};   // datos creados

  T.admin = await login("admin@pruebas.ec");

  // ---------- Datos base (creados por el administrador) ----------
  // Todos los productores pertenecen a la misma empresa.
  const productor = (nombre, cedula) => ({
    nombre,
    apellido: "Pruebas",
    cedula,
    telefono: "0990000000",
    email: `${nombre.toLowerCase()}@finca.ec`
  });

  D.P1 = await crear("/productores", T.admin, productor("Pedro", "0900000001"), "productor");
  D.P2 = await crear("/productores", T.admin, productor("María", "0900000027"), "productor");
  D.P3 = await crear("/productores", T.admin, productor("José", "0900000035"), "productor");

  const usuario = (nombre, email, rol, extra = {}) => ({
    nombre, apellido: "Pruebas", email, password: CLAVE, rol, ...extra
  });


  grupo("1. Autenticación y sesión");

  await caso("A01", "Inicio de sesión con credenciales correctas", "200 y token", async () => {
    const r = await http("POST", "/auth/login", { body: { email: "admin@pruebas.ec", password: CLAVE } });
    return { ok: r.status === 200 && Boolean(r.datos.token), obtenido: `${r.status}${r.datos.token ? " · token recibido" : ""}` };
  });

  await caso("A02", "Inicio de sesión con contraseña incorrecta", "401", async () =>
    codigo(await http("POST", "/auth/login", { body: { email: "admin@pruebas.ec", password: "otra-clave" } }), 401));

  await caso("A03 / R01", "Consultar lotes sin token", "401", async () =>
    codigo(await http("GET", "/lotes"), 401));

  await caso("A04", "Consultar lotes con un token alterado", "401", async () =>
    codigo(await http("GET", "/lotes", { token: T.admin.slice(0, -4) + "abcd" }), 401));

  await caso("A05 / R02", "Registro público de usuarios sin sesión", "401 (el registro ya no es público)", async () =>
    codigo(await http("POST", "/auth/registro", { body: usuario("Intruso", "intruso@x.ec", "administrador") }), 401));


  grupo("2. Gestión de usuarios (solo administrador)");

  await caso("U01", "El administrador crea las cuentas de productor y certificador", "201 en cada una", async () => {
    D.uProd = await crear("/usuarios", T.admin, usuario("Pedro", "productor@pruebas.ec", "productor", { productor: D.P1._id }), "usuario");
    D.uCert = await crear("/usuarios", T.admin, usuario("Carla", "certificador@pruebas.ec", "certificador"), "usuario");
    D.uCert2 = await crear("/usuarios", T.admin, usuario("Luis", "certificador2@pruebas.ec", "certificador"), "usuario");
    return { ok: true, obtenido: "201 · 3 cuentas creadas" };
  });

  T.prod = await login("productor@pruebas.ec");
  T.cert = await login("certificador@pruebas.ec");
  T.cert2 = await login("certificador2@pruebas.ec");

  await caso("U02", "Contraseña con menos de 6 caracteres", "400", async () =>
    codigo(await http("POST", "/usuarios", { token: T.admin, body: { ...usuario("X", "corta@pruebas.ec", "certificador"), password: "123" } }), 400));

  await caso("U03", "Correo de usuario repetido", "400", async () =>
    codigo(await http("POST", "/usuarios", { token: T.admin, body: usuario("X", "productor@pruebas.ec", "certificador") }), 400));

  await caso("U04 / R03", "Un productor intenta crear usuarios", "403", async () =>
    codigo(await http("POST", "/usuarios", { token: T.prod, body: usuario("X", "x@pruebas.ec", "administrador") }), 403));

  await caso("U05 / R04", "Lista de certificadores sin sesión", "401", async () =>
    codigo(await http("GET", "/usuarios/certificadores"), 401));

  await caso("U06", "El perfil del productor incluye la empresa", "200 · nombre de la empresa", async () => {
    const r = await http("GET", "/auth/perfil", { token: T.prod });
    const empresa = r.datos?.empresa?.nombre;
    return { ok: r.status === 200 && Boolean(empresa) && !("asociacion" in (r.datos || {})), obtenido: `${r.status} · ${empresa || "sin empresa"}` };
  });

  await caso("U07", "Ya no se puede crear una cuenta con el rol asociación", "400 · rol no válido", async () =>
    codigo(await http("POST", "/usuarios", { token: T.admin, body: usuario("Ana", "asociacion@pruebas.ec", "asociacion") }), 400));

  await caso("U08", "La ruta de asociaciones ya no existe", "404", async () =>
    codigo(await http("GET", "/asociaciones", { token: T.admin }), 404));


  grupo("3. Lotes y alcance por rol");

  const lote = (prod, cantidad) => ({
    productor: prod._id,
    cantidad,
    unidad: "kg",
    descripcion: "Lote de prueba",
    ubicacion: { provincia: "Guayas", canton: "Milagro" }
  });

  D.L1 = await crear("/lotes", T.admin, lote(D.P1, 1200), "lote");
  D.L2 = await crear("/lotes", T.admin, lote(D.P2, 800), "lote");
  D.L3 = await crear("/lotes", T.admin, lote(D.P3, 500), "lote");

  await caso("L01", "Los lotes reciben un código automático", "Códigos LOT-…", async () => {
    const c = [D.L1, D.L2, D.L3].map((l) => l.codigo);
    return { ok: c.every((x) => /^LOT-/.test(x || "")), obtenido: c.join(", ") };
  });

  await caso("L02", "Registrar un lote de un producto distinto al cacao", "400 (alcance: solo cacao fino de aroma)", async () =>
    codigo(await http("POST", "/lotes", { token: T.admin, body: { ...lote(D.P1, 10), producto: "Café" } }), 400));

  await caso("L03", "Registrar un lote sin productor", "400", async () =>
    codigo(await http("POST", "/lotes", { token: T.admin, body: { cantidad: 10 } }), 400));

  await caso("L04 / R05", "El administrador ve todos los lotes", "200 · 3 lotes", async () => {
    const r = await http("GET", "/lotes", { token: T.admin });
    const l = lista(r.datos, "lotes");
    return { ok: r.status === 200 && l.length === 3, obtenido: `${r.status} · ${l.length} lotes` };
  });

  await caso("L05 / R06", "Los lotes ya no tienen asociación", "Ningún lote con el campo asociación", async () => {
    const l = lista((await http("GET", "/lotes", { token: T.admin })).datos, "lotes");
    const conAsociacion = l.filter((x) => "asociacion" in x).length;
    return { ok: l.length === 3 && conAsociacion === 0, obtenido: `${l.length} lotes · ${conAsociacion} con asociación` };
  });

  await caso("L06 / R07", "El productor solo ve sus lotes", "200 · solo L1", async () => {
    const r = await http("GET", "/lotes", { token: T.prod });
    const l = lista(r.datos, "lotes");
    return { ok: r.status === 200 && iguales(ids(l), ids([D.L1])), obtenido: `${r.status} · ${l.map((x) => x.codigo).join(", ") || "ninguno"}` };
  });

  await caso("L07", "El certificador sin asignaciones no ve lotes", "200 · 0 lotes", async () => {
    const r = await http("GET", "/lotes", { token: T.cert });
    const l = lista(r.datos, "lotes");
    return { ok: r.status === 200 && l.length === 0, obtenido: `${r.status} · ${l.length} lotes` };
  });

  await caso("L08 / R09", "El productor abre un lote de otro productor", "403", async () =>
    codigo(await http("GET", `/lotes/${D.L2._id}`, { token: T.prod }), 403));

  await caso("L09 / R12", "El productor intenta registrar un lote", "403", async () =>
    codigo(await http("POST", "/lotes", { token: T.prod, body: lote(D.P1, 10) }), 403));

  await caso("L10 / R13", "El productor intenta editar su lote", "403 · lo gestiona la empresa", async () =>
    codigo(await http("PUT", `/lotes/${D.L1._id}`, { token: T.prod, body: { cantidad: 1 } }), 403));

  await caso("L11", "El administrador cambia la etapa de un lote", "200 · etapa en_produccion", async () =>
    codigo(await http("PATCH", `/lotes/${D.L1._id}/estado`, { token: T.admin, body: { estado: "en_produccion" } }), 200));


  grupo("4. Productores");

  await caso("P01 / R14", "Un productor intenta registrar otro productor", "403", async () =>
    codigo(await http("POST", "/productores", { token: T.prod, body: productor("Rosa", "0900000004") }), 403));

  await caso("P02", "Cédula de productor repetida", "400", async () =>
    codigo(await http("POST", "/productores", { token: T.admin, body: productor("Otro", "0900000001") }), 400));

  await caso("P03", "El administrador ve a todos los productores de la empresa", "200 · 3 productores", async () => {
    const r = await http("GET", "/productores", { token: T.admin });
    const l = lista(r.datos, "productores");
    return { ok: r.status === 200 && l.length === 3, obtenido: `${r.status} · ${l.length} productores` };
  });


  grupo("5. Trazabilidad");

  await caso("T01 / R10", "El productor registra una actividad en su lote", "201", async () => {
    const r = await http("POST", "/trazabilidad", { token: T.prod, body: { lote: D.L1._id, tipo: "siembra", descripcion: "Siembra de plántulas injertadas", ubicacion: "Finca La Esperanza" } });
    D.E1 = r.datos?.evento;
    return codigo(r, 201);
  });

  await caso("T02 / R11", "El productor registra una actividad en un lote ajeno", "403", async () =>
    codigo(await http("POST", "/trazabilidad", { token: T.prod, body: { lote: D.L2._id, tipo: "riego", descripcion: "x" } }), 403));

  await caso("T03 / R17", "El certificador intenta registrar una actividad", "403", async () =>
    codigo(await http("POST", "/trazabilidad", { token: T.cert, body: { lote: D.L1._id, tipo: "riego", descripcion: "x" } }), 403));

  await caso("T04", "Actividad sin descripción", "400", async () =>
    codigo(await http("POST", "/trazabilidad", { token: T.admin, body: { lote: D.L1._id, tipo: "riego" } }), 400));

  await caso("T05", "El administrador registra más actividades del lote", "201", async () => {
    const r1 = await http("POST", "/trazabilidad", { token: T.admin, body: { lote: D.L1._id, tipo: "cosecha", descripcion: "Cosecha de mazorcas maduras" } });
    const r2 = await http("POST", "/trazabilidad", { token: T.admin, body: { lote: D.L1._id, tipo: "otro", descripcion: "Registro duplicado por error" } });
    D.E3 = r2.datos?.evento;
    return { ok: r1.status === 201 && r2.status === 201, obtenido: `${r1.status}, ${r2.status}` };
  });

  await caso("T06", "El productor intenta eliminar una actividad", "403", async () =>
    codigo(await http("DELETE", `/trazabilidad/${D.E1._id}`, { token: T.prod }), 403));

  await caso("T07", "El administrador elimina una actividad", "200", async () =>
    codigo(await http("DELETE", `/trazabilidad/${D.E3._id}`, { token: T.admin }), 200));

  await caso("T08", "Historial del lote", "200 · 2 actividades", async () => {
    const r = await http("GET", `/trazabilidad/lote/${D.L1._id}`, { token: T.prod });
    const n = lista(r.datos, "eventos").length;
    return { ok: r.status === 200 && n === 2, obtenido: `${r.status} · ${n} actividades` };
  });


  grupo("6. Certificaciones");

  await caso("C01", "El productor solicita la certificación de su lote", "201 · pendiente", async () => {
    const r = await http("POST", "/certificaciones", { token: T.prod, body: { lote: D.L1._id, tipoCertificacion: "Producción Orgánica" } });
    D.C1 = r.datos?.certificacion;
    return { ok: r.status === 201 && D.C1?.estado === "pendiente", obtenido: `${r.status} · ${D.C1?.estado}` };
  });

  await caso("C02", "El productor solicita sobre un lote ajeno", "403", async () =>
    codigo(await http("POST", "/certificaciones", { token: T.prod, body: { lote: D.L3._id, tipoCertificacion: "Producción Orgánica" } }), 403));

  D.C2 = await crear("/certificaciones", T.admin, { lote: D.L3._id, tipoCertificacion: "Calidad del Producto" }, "certificacion");

  await caso("C03", "Aprobar una solicitud que no está en revisión", "400", async () =>
    codigo(await http("PATCH", `/certificaciones/${D.C1._id}/aprobar`, { token: T.admin, body: {} }), 400));

  await caso("C04", "Descargar el PDF de una certificación no aprobada", "400", async () =>
    codigo(await http("GET", `/certificaciones/${D.C1._id}/pdf`, { token: T.admin }), 400));

  await caso("C05", "El administrador asigna el certificador", "200 · en_revision", async () => {
    const r = await http("PATCH", `/certificaciones/${D.C1._id}/asignar-certificador`, { token: T.admin, body: { certificador: D.uCert._id } });
    const estado = r.datos?.certificacion?.estado;
    return { ok: r.status === 200 && estado === "en_revision", obtenido: `${r.status} · ${estado}` };
  });

  await caso("C06 / R15", "El certificador solo ve las certificaciones asignadas", "200 · solo C1", async () => {
    const r = await http("GET", "/certificaciones", { token: T.cert });
    const l = lista(r.datos, "certificaciones");
    return { ok: r.status === 200 && iguales(ids(l), ids([D.C1])), obtenido: `${r.status} · ${l.length} certificaciones` };
  });

  await caso("R08", "El certificador ve el lote de su certificación asignada", "200 · solo L1", async () => {
    const r = await http("GET", "/lotes", { token: T.cert });
    const l = lista(r.datos, "lotes");
    return { ok: r.status === 200 && iguales(ids(l), ids([D.L1])), obtenido: `${r.status} · ${l.map((x) => x.codigo).join(", ") || "ninguno"}` };
  });

  await caso("C07 / R16", "El certificador aprueba una certificación no asignada", "403", async () =>
    codigo(await http("PATCH", `/certificaciones/${D.C2._id}/aprobar`, { token: T.cert, body: {} }), 403));

  await caso("C08", "Otro certificador aprueba la certificación de su colega", "403", async () =>
    codigo(await http("PATCH", `/certificaciones/${D.C1._id}/aprobar`, { token: T.cert2, body: {} }), 403));

  await caso("C09", "Rechazar sin indicar el motivo", "400", async () =>
    codigo(await http("PATCH", `/certificaciones/${D.C1._id}/rechazar`, { token: T.cert, body: {} }), 400));

  await caso("C10", "El certificador aprueba con fecha de vencimiento", "200 · aprobada", async () => {
    const vence = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const r = await http("PATCH", `/certificaciones/${D.C1._id}/aprobar`, {
      token: T.cert,
      body: { fechaVencimiento: vence, resultadoInspeccion: "Cumple BPA", observaciones: "Sin observaciones" }
    });
    const estado = r.datos?.certificacion?.estado;
    return { ok: r.status === 200 && estado === "aprobada", obtenido: `${r.status} · ${estado}` };
  });

  await caso("C11", "Descargar el certificado PDF de la aprobada", "200 · application/pdf", async () => {
    const r = await http("GET", `/certificaciones/${D.C1._id}/pdf`, { token: T.prod });
    return { ok: r.status === 200 && r.tipo.includes("pdf"), obtenido: `${r.status} · ${r.tipo}` };
  });

  await caso("C12", "El administrador rechaza una solicitud pendiente con motivo", "200 · rechazada", async () => {
    const r = await http("PATCH", `/certificaciones/${D.C2._id}/rechazar`, { token: T.admin, body: { observaciones: "Falta documentación del lote" } });
    const estado = r.datos?.certificacion?.estado;
    return { ok: r.status === 200 && estado === "rechazada", obtenido: `${r.status} · ${estado}` };
  });


  grupo("6b. Firma del certificado PDF (manuscrita escaneada o electrónica)");

  let original;
  const FIRMA = `/certificaciones/${D.C1._id}/firma`;

  await caso("F01", "Descargar el PDF original para firmarlo", "200 · application/pdf", async () => {
    const r = await http("GET", `/certificaciones/${D.C1._id}/pdf?version=original`, { token: T.cert });
    original = Buffer.from(r.datos);
    return { ok: r.status === 200 && r.tipo.includes("pdf") && original.subarray(0, 5).toString() === "%PDF-", obtenido: `${r.status} · ${r.tipo} · ${original.length} bytes` };
  });

  // PDF como el que sale de un escáner: otro archivo, sin firma electrónica
  const escaneado = await new Promise((ok) => {
    const doc = new PDFDocument();
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => ok(Buffer.concat(partes)));
    doc.text("Certificado impreso, firmado a mano y escaneado");
    doc.end();
  });

  await caso("F02", "Subir el PDF escaneado sin confirmar que está firmado", "400 · pide confirmar", async () => {
    const r = await http("POST", FIRMA, { token: T.cert, pdf: escaneado });
    return { ok: r.status === 400 && /[Cc]onfirma/.test(r.datos?.mensaje || ""), obtenido: `${r.status} · ${r.datos?.mensaje}` };
  });

  await caso("F03", "Un productor intenta subir el certificado firmado", "403", async () =>
    codigo(await http("POST", `${FIRMA}?confirmo=si`, { token: T.prod, pdf: escaneado }), 403));

  await caso("F04", "Otro certificador intenta subirlo", "403", async () =>
    codigo(await http("POST", `${FIRMA}?confirmo=si`, { token: T.cert2, pdf: escaneado }), 403));

  await caso("F05", "El administrador intenta subirlo", "403 · solo el certificador asignado", async () =>
    codigo(await http("POST", `${FIRMA}?confirmo=si`, { token: T.admin, pdf: escaneado }), 403));

  await caso("F06", "Subir un archivo que no es PDF", "400 · no es un PDF", async () => {
    const r = await http("POST", `${FIRMA}?confirmo=si`, { token: T.cert, pdf: Buffer.from("\xff\xd8\xff foto") });
    return { ok: r.status === 400 && /no es un PDF/.test(r.datos?.mensaje || ""), obtenido: `${r.status} · ${r.datos?.mensaje}` };
  });

  await caso("F07", "El certificador asignado confirma y sube el PDF escaneado", "200 · firma manuscrita a su nombre", async () => {
    const r = await http("POST", `${FIRMA}?confirmo=si`, { token: T.cert, pdf: escaneado });
    const f = r.datos?.firma || {};
    return {
      ok: r.status === 200 && f.firmada === true && f.tipo === "manuscrita" && /Carla/.test(f.firmante || ""),
      obtenido: `${r.status} · ${f.tipo || r.datos?.mensaje} · ${f.firmante || ""}`
    };
  });

  await caso("F08", "La descarga entrega ahora la versión firmada", "Mismo archivo que se subió", async () => {
    const r = await http("GET", `/certificaciones/${D.C1._id}/pdf`, { token: T.prod });
    const iguales = Buffer.from(r.datos).equals(escaneado);
    return { ok: r.status === 200 && iguales, obtenido: `${r.status} · ${iguales ? "idéntico" : "distinto"}` };
  });

  let verificacion;
  let codigoVerif;

  await caso("F09", "Página pública de verificación del certificado", "200 · vigente y firmado a mano, sin datos personales", async () => {
    const c = await http("GET", `/certificaciones/${D.C1._id}`, { token: T.admin });
    codigoVerif = c.datos?.codigoVerificacion;
    const r = await http("GET", `/public/certificados/${codigoVerif}`);
    verificacion = r.datos;
    const texto = JSON.stringify(r.datos || {});
    const fuga = ["0900000001", "@finca.ec", "@pruebas.ec", String(D.P1._id)].some((x) => texto.includes(x));
    return {
      ok: r.status === 200 && r.datos?.estado === "vigente" && r.datos?.firma?.firmada === true && r.datos?.firma?.tipo === "manuscrita" && !fuga,
      obtenido: `${r.status} · ${r.datos?.estado} · ${r.datos?.firma?.tipo}${fuga ? " · EXPONE DATOS" : ""}`
    };
  });

  await caso("F10", "La huella SHA-256 publicada coincide con el PDF subido", "Huellas iguales", async () => {
    const huella = require("crypto").createHash("sha256").update(escaneado).digest("hex");
    return { ok: verificacion?.firma?.sha256 === huella, obtenido: verificacion?.firma?.sha256 === huella ? "iguales" : "distintas" };
  });

  await caso("F11", "Opcional: subir una versión con firma electrónica", "200 · se reconoce como electrónica", async () => {
    const r = await http("POST", `${FIRMA}?confirmo=si`, { token: T.cert, pdf: firmarPdfPrueba(original) });
    const f = r.datos?.firma || {};
    const v = await http("GET", `/public/certificados/${codigoVerif}`);
    return {
      ok: r.status === 200 && f.tipo === "electronica" && f.firmante === "CARLA MONTESDEOCA" && v.datos?.firma?.tipo === "electronica",
      obtenido: `${r.status} · ${f.tipo || r.datos?.mensaje} · ${f.firmante || ""}`
    };
  });

  await caso("F12", "Subir un PDF con firma electrónica de otro certificado", "400 · no es este certificado", async () => {
    const ajeno = fs.readFileSync(path.join(__dirname, "fixtures", "certificado-firmado-prueba.pdf"));
    const r = await http("POST", `${FIRMA}?confirmo=si`, { token: T.cert, pdf: ajeno });
    return { ok: r.status === 400 && /no es el certificado/.test(r.datos?.mensaje || ""), obtenido: `${r.status} · ${r.datos?.mensaje}` };
  });

  await caso("F13", "Código de verificación inexistente", "404", async () =>
    codigo(await http("GET", "/public/certificados/codigoInventado123"), 404));


  grupo("7. Códigos QR y consulta pública");

  await caso("Q01 / R18", "El productor genera el QR de su lote", "200 o 201 con imagen", async () => {
    const r = await http("POST", `/qr/lote/${D.L1._id}`, { token: T.prod });
    D.qr = r.datos?.qr;
    return { ok: [200, 201].includes(r.status) && Boolean(r.datos?.imagen) && Boolean(D.qr?.token), obtenido: `${r.status}${r.datos?.imagen ? " · imagen PNG" : ""}` };
  });

  await caso("Q02 / R19", "El productor intenta regenerar el QR", "403", async () =>
    codigo(await http("PATCH", `/qr/lote/${D.L1._id}/regenerar`, { token: T.prod }), 403));

  await caso("Q03", "La URL pública apunta a la página del frontend", "…/publico/qr/<token>", async () => ({
    ok: (D.qr?.urlPublica || "").endsWith(`/publico/qr/${D.qr?.token}`),
    obtenido: D.qr?.urlPublica
  }));

  let publico;

  await caso("Q04 / R21", "Consulta pública del QR sin iniciar sesión", "200", async () => {
    const r = await http("GET", `/public/qr/${D.qr.token}`);
    publico = r.datos;
    return codigo(r, 200);
  });

  await caso("Q05", "La consulta pública muestra la certificación vigente", "estado vigente", async () => ({
    ok: publico?.certificacion?.vigente === true,
    obtenido: `${publico?.certificacion?.estado} · vigente=${publico?.certificacion?.vigente}`
  }));

  await caso("Q12", "La consulta pública indica que el certificado está firmado", "firmada y con enlace de verificación", async () => ({
    ok: publico?.certificaciones?.[0]?.firmada === true && Boolean(publico?.certificaciones?.[0]?.codigoVerificacion),
    obtenido: `firmada ${publico?.certificaciones?.[0]?.firmada} · código ${publico?.certificaciones?.[0]?.codigoVerificacion ? "sí" : "no"}`
  }));

  await caso("Q06", "La consulta pública muestra el historial del lote", "2 actividades", async () => ({
    ok: publico?.trazabilidad?.totalEventos === 2,
    obtenido: `${publico?.trazabilidad?.totalEventos} actividades`
  }));

  await caso("Q07", "La consulta pública NO expone datos personales", "Sin cédula, teléfono, correo ni ids", async () => {
    const texto = JSON.stringify(publico || {});
    const fugas = ["0900000001", "0990000000", "@finca.ec", "@pruebas.ec", "cedula", "password", String(D.P1._id), String(D.uProd._id)]
      .filter((x) => texto.includes(x));
    return { ok: fugas.length === 0, obtenido: fugas.length ? `Aparece: ${fugas.join(", ")}` : "Ningún dato personal" };
  });

  await caso("Q08", "Cada consulta aumenta el contador de escaneos", "El contador sube en 1", async () => {
    const antes = publico?.qr?.totalEscaneos ?? 0;
    const r = await http("GET", `/public/qr/${D.qr.token}`);
    const despues = r.datos?.qr?.totalEscaneos ?? 0;
    return { ok: despues === antes + 1, obtenido: `${antes} → ${despues}` };
  });

  await caso("Q09", "Token inexistente", "404", async () =>
    codigo(await http("GET", "/public/qr/token-que-no-existe"), 404));

  await caso("Q10", "Al regenerar, el código anterior deja de funcionar", "Nuevo 200 · anterior 404", async () => {
    const r = await http("PATCH", `/qr/lote/${D.L1._id}/regenerar`, { token: T.admin });
    const nuevo = r.datos?.qr?.token;
    const viejo = await http("GET", `/public/qr/${D.qr.token}`);
    const actual = await http("GET", `/public/qr/${nuevo}`);
    D.qr = r.datos?.qr;
    return { ok: r.status === 200 && viejo.status === 404 && actual.status === 200, obtenido: `regenerar ${r.status} · anterior ${viejo.status} · nuevo ${actual.status}` };
  });

  await caso("Q11", "Un QR desactivado ya no muestra el lote", "404", async () => {
    await http("PATCH", `/qr/lote/${D.L1._id}/desactivar`, { token: T.admin });
    return codigo(await http("GET", `/public/qr/${D.qr.token}`), 404);
  });


  grupo("8. Estadísticas y cuentas desactivadas");

  await caso("E01", "Dashboard del administrador sin datos de asociaciones", "200 · sin totalAsociaciones", async () => {
    const r = await http("GET", "/estadisticas/dashboard", { token: T.admin });
    const resumen = r.datos?.resumen || {};
    return { ok: r.status === 200 && !("totalAsociaciones" in resumen) && resumen.totalProductores === 3, obtenido: `${r.status} · ${resumen.totalProductores} productores${"totalAsociaciones" in resumen ? " · aún cuenta asociaciones" : ""}` };
  });

  await caso("S01 / R20", "Una cuenta desactivada pierde el acceso de inmediato", "200 y después 403", async () => {
    const r = await http("PATCH", `/usuarios/${D.uProd._id}/estado`, { token: T.admin, body: { activo: false } });
    const despues = await http("GET", "/lotes", { token: T.prod });
    return { ok: r.status === 200 && despues.status === 403, obtenido: `desactivar ${r.status} · luego ${despues.status} ${despues.datos?.mensaje || ""}` };
  });

  await caso("S02", "La cuenta desactivada no puede iniciar sesión", "403", async () =>
    codigo(await http("POST", "/auth/login", { body: { email: "productor@pruebas.ec", password: CLAVE } }), 403));


  grupo("9. Solicitudes de cuenta desde el inicio de sesión");

  const solicitud = (extra) => ({
    nombre: "Rosa",
    apellido: "Pruebas",
    cedula: "0912345675",
    telefono: "0991234567",
    provincia: "Guayas",
    canton: "Milagro",
    parroquia: "Recinto Los Monos",
    direccion: "Finca La Ceiba, km 5 vía a Naranjito",
    email: "rosa@finca.ec",
    password: CLAVE,
    rolSolicitado: "productor",
    aceptaPrivacidad: true,
    ...extra
  });

  const pendientesDe = async (token) => {
    const r = await http("GET", "/solicitudes?estado=pendiente", { token });
    return lista(r.datos, "solicitudes");
  };

  await caso("SC01", "Datos públicos de la empresa para el formulario", "200 · nombre de la empresa", async () => {
    const r = await http("GET", "/public/empresa");
    const antigua = await http("GET", "/public/asociaciones");
    return { ok: r.status === 200 && Boolean(r.datos?.nombre) && antigua.status === 404, obtenido: `${r.status} · ${r.datos?.nombre || "sin nombre"} · /public/asociaciones ${antigua.status}` };
  });

  await caso("SC02", "Solicitar una cuenta de administrador", "400", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud({ rolSolicitado: "administrador" }) }), 400));

  await caso("SC03", "Solicitud con cédula inválida", "400", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud({ cedula: "0912345670" }) }), 400));

  await caso("SC23", "Solicitud sin celular ni dirección de la finca", "400", async () => {
    const r1 = await http("POST", "/public/solicitudes", { body: solicitud({ telefono: "" }) });
    const r2 = await http("POST", "/public/solicitudes", { body: solicitud({ direccion: "" }) });
    return { ok: r1.status === 400 && r2.status === 400, obtenido: `sin celular ${r1.status} · sin dirección ${r2.status}` };
  });

  await caso("SC25", "Solicitud sin aceptar el aviso de privacidad", "400", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud({ aceptaPrivacidad: false }) }), 400));

  await caso("SC04", "Un productor envía su solicitud sin iniciar sesión", "201", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud() }), 201));

  await caso("SC05", "Segunda solicitud con el mismo correo", "400", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud({ cedula: "1700000001" }) }), 400));

  await caso("SC06", "Solicitud con el correo de una cuenta existente", "400", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud({ cedula: "1700000001", email: "admin@pruebas.ec" }) }), 400));

  await caso("SC07", "Iniciar sesión antes de la aprobación", "403 · solicitud pendiente", async () => {
    const r = await http("POST", "/auth/login", { body: { email: "rosa@finca.ec", password: CLAVE } });
    return { ok: r.status === 403 && /pendiente/i.test(r.datos?.mensaje || ""), obtenido: `${r.status} · ${r.datos?.mensaje}` };
  });

  await caso("SC08", "Con otra contraseña no se revela la solicitud", "401", async () =>
    codigo(await http("POST", "/auth/login", { body: { email: "rosa@finca.ec", password: "otra-clave" } }), 401));

  await caso("SC09", "Campo trampa lleno (envío automático)", "201 pero no se guarda", async () => {
    const antes = (await pendientesDe(T.admin)).length;
    const r = await http("POST", "/public/solicitudes", { body: solicitud({ email: "robot@spam.ec", cedula: "1700000001", sitioWeb: "http://spam" }) });
    const despues = (await pendientesDe(T.admin)).length;
    return { ok: r.status === 201 && despues === antes, obtenido: `${r.status} · pendientes ${antes} → ${despues}` };
  });

  // Solicitudes que usan los casos siguientes
  await http("POST", "/public/solicitudes", { body: solicitud({ nombre: "Luis", email: "luis@finca.ec", cedula: "1700000001" }) });
  await http("POST", "/public/solicitudes", { body: solicitud({ nombre: "María", email: "maria@finca.ec", cedula: "0900000027" }) });

  const pendAdmin = await pendientesDe(T.admin);
  const sol = (email) => pendAdmin.find((x) => x.email === email);

  await caso("SC10", "El administrador ve todas las solicitudes pendientes", "Luis, María y Rosa", async () => {
    const correos = pendAdmin.map((x) => x.email).sort();
    return { ok: iguales(correos, ["luis@finca.ec", "maria@finca.ec", "rosa@finca.ec"]), obtenido: correos.join(", ") || "ninguna" };
  });

  await caso("SC11", "Las respuestas de revisión no incluyen la contraseña", "Sin campo password", async () => ({
    ok: pendAdmin.length > 0 && pendAdmin.every((x) => !("password" in x)),
    obtenido: pendAdmin.some((x) => "password" in x) ? "Incluye password" : "Sin password"
  }));

  await caso("SC12", "Contador de pendientes del administrador", "3", async () => {
    const r = await http("GET", "/solicitudes/pendientes/total", { token: T.admin });
    return { ok: r.status === 200 && r.datos?.total === 3, obtenido: `${r.status} · ${r.datos?.total}` };
  });

  await caso("SC13", "Un certificador intenta revisar solicitudes", "403", async () =>
    codigo(await http("GET", "/solicitudes", { token: T.cert }), 403));

  await caso("SC14", "Un certificador intenta aprobar una solicitud", "403", async () =>
    codigo(await http("PATCH", `/solicitudes/${sol("luis@finca.ec")._id}/aprobar`, { token: T.cert2, body: {} }), 403));

  await caso("SC15", "El administrador aprueba a un productor nuevo", "200 · cuenta y ficha de productor", async () => {
    const r = await http("PATCH", `/solicitudes/${sol("rosa@finca.ec")._id}/aprobar`, { token: T.admin, body: {} });
    const prods = lista((await http("GET", "/productores", { token: T.admin })).datos, "productores");
    const ficha = prods.find((p) => p.cedula === "0912345675");
    D.fichaRosa = ficha;
    return { ok: r.status === 200 && Boolean(ficha), obtenido: `${r.status} · ficha ${ficha ? "creada" : "no encontrada"}` };
  });

  await caso("SC24", "La ficha del productor recibe el celular y la ubicación de la finca", "Celular, dirección y ubicación completos", async () => ({
    ok: D.fichaRosa?.telefono === "0991234567" &&
      /Finca La Ceiba.*Recinto Los Monos, Milagro, Guayas/.test(D.fichaRosa?.direccion || "") &&
      D.fichaRosa?.ubicacion?.canton === "Milagro" && D.fichaRosa?.ubicacion?.parroquia === "Recinto Los Monos",
    obtenido: `${D.fichaRosa?.telefono || "sin celular"} · ${D.fichaRosa?.direccion || "sin dirección"} · cantón ${D.fichaRosa?.ubicacion?.canton || "—"}`
  }));

  await caso("SC16", "La persona aprobada inicia sesión y ve su panel", "200 · rol productor", async () => {
    const r = await http("POST", "/auth/login", { body: { email: "rosa@finca.ec", password: CLAVE } });
    const lotes = r.status === 200 ? await http("GET", "/lotes", { token: r.datos.token }) : { status: 0 };
    return { ok: r.status === 200 && r.datos?.usuario?.rol === "productor" && lotes.status === 200, obtenido: `login ${r.status} · ${r.datos?.usuario?.rol} · lotes ${lotes.status}` };
  });

  await caso("SC26", "Quien entra por solicitud aprobada ya tiene el aviso aceptado", "consentimientoVigente = true", async () => {
    const r = await http("POST", "/auth/login", { body: { email: "rosa@finca.ec", password: CLAVE } });
    return { ok: r.datos?.usuario?.consentimientoVigente === true, obtenido: `consentimientoVigente = ${r.datos?.usuario?.consentimientoVigente}` };
  });

  await caso("SC27", "Una cuenta creada por el administrador debe aceptar el aviso", "false y, tras aceptarlo, true", async () => {
    const antes = await http("GET", "/auth/perfil", { token: T.cert });
    const malo = await http("POST", "/auth/privacidad", { token: T.cert, body: { version: "vieja" } });
    const r = await http("POST", "/auth/privacidad", { token: T.cert, body: { version: VERSION_AVISO_PRIVACIDAD } });
    const despues = await http("GET", "/auth/perfil", { token: T.cert });
    return {
      ok: antes.datos?.consentimientoVigente === false && malo.status === 400 && r.status === 200 && despues.datos?.consentimientoVigente === true,
      obtenido: `antes ${antes.datos?.consentimientoVigente} · versión vieja ${malo.status} · aceptar ${r.status} · después ${despues.datos?.consentimientoVigente}`
    };
  });

  await caso("SC17", "Aprobar dos veces la misma solicitud", "400", async () =>
    codigo(await http("PATCH", `/solicitudes/${sol("rosa@finca.ec")._id}/aprobar`, { token: T.admin, body: {} }), 400));

  await caso("SC18", "La cédula de un productor ya registrado se vincula a su ficha", "200 · sin ficha duplicada", async () => {
    const antes = lista((await http("GET", "/productores", { token: T.admin })).datos, "productores").length;
    const r = await http("PATCH", `/solicitudes/${sol("maria@finca.ec")._id}/aprobar`, { token: T.admin, body: {} });
    const despues = lista((await http("GET", "/productores", { token: T.admin })).datos, "productores").length;
    return { ok: r.status === 200 && despues === antes, obtenido: `${r.status} · productores ${antes} → ${despues}` };
  });

  await caso("SC19", "Rechazar sin motivo", "400", async () =>
    codigo(await http("PATCH", `/solicitudes/${sol("luis@finca.ec")._id}/rechazar`, { token: T.admin, body: {} }), 400));

  await caso("SC20", "Rechazar con motivo y la persona ve el motivo al entrar", "200 y luego 403 con el motivo", async () => {
    const r = await http("PATCH", `/solicitudes/${sol("luis@finca.ec")._id}/rechazar`, { token: T.admin, body: { motivo: "No figura como productor de la empresa" } });
    const l = await http("POST", "/auth/login", { body: { email: "luis@finca.ec", password: CLAVE } });
    return { ok: r.status === 200 && l.status === 403 && /productor de la empresa/.test(l.datos?.mensaje || ""), obtenido: `${r.status} · login ${l.status} ${l.datos?.mensaje || ""}` };
  });

  await caso("SC21", "Solicitar una cuenta de asociación", "400 · solo cuentas de productor", async () =>
    codigo(await http("POST", "/public/solicitudes", { body: solicitud({ nombre: "Elena", email: "elena@finca.ec", cedula: "1300000013", rolSolicitado: "asociacion" }) }), 400));

  await caso("SC22", "La cuenta aprobada pertenece a la empresa", "Perfil con empresa y sin asociación", async () => {
    const t = await login("rosa@finca.ec");
    const p = await http("GET", "/auth/perfil", { token: t });
    return { ok: p.status === 200 && Boolean(p.datos?.empresa?.nombre) && !("asociacion" in (p.datos || {})), obtenido: `${p.status} · ${p.datos?.empresa?.nombre || "sin empresa"}` };
  });


  grupo("10. Mi perfil: celular y contraseña");

  // Usa la cuenta de Rosa (productora aprobada en el grupo 9)
  const tRosa = await login("rosa@finca.ec");

  await caso("PF01", "El perfil muestra el celular de la ficha del productor", "0991234567", async () => {
    const r = await http("GET", "/auth/perfil", { token: tRosa });
    return { ok: r.status === 200 && r.datos?.telefono === "0991234567", obtenido: `${r.status} · ${r.datos?.telefono || "sin celular"}` };
  });

  await caso("PF02", "Guardar un celular con formato inválido", "400", async () =>
    codigo(await http("PATCH", "/auth/perfil", { token: tRosa, body: { telefono: "12345" } }), 400));

  await caso("PF03", "Cambiar el celular también actualiza la ficha del productor", "200 · ficha con 0987654321", async () => {
    const r = await http("PATCH", "/auth/perfil", { token: tRosa, body: { telefono: "098 765 4321" } });
    const prods = lista((await http("GET", "/productores", { token: T.admin })).datos, "productores");
    const ficha = prods.find((x) => x.cedula === "0912345675");
    return { ok: r.status === 200 && r.datos?.usuario?.telefono === "0987654321" && ficha?.telefono === "0987654321", obtenido: `${r.status} · cuenta ${r.datos?.usuario?.telefono} · ficha ${ficha?.telefono}` };
  });

  await caso("PF04", "Cambiar la contraseña con la actual incorrecta", "400", async () =>
    codigo(await http("PUT", "/auth/password", { token: tRosa, body: { actual: "otra-clave", nueva: "nueva-clave-1" } }), 400));

  await caso("PF05", "Cambiar la contraseña por una demasiado corta", "400", async () =>
    codigo(await http("PUT", "/auth/password", { token: tRosa, body: { actual: CLAVE, nueva: "123" } }), 400));

  // El token de Rosa se emitió en otro segundo que el cambio
  await new Promise((listo) => setTimeout(listo, 1100));
  let tNuevo;

  await caso("PF06", "Cambiar la contraseña cierra las demás sesiones", "200 · token viejo 401 · token nuevo 200", async () => {
    const r = await http("PUT", "/auth/password", { token: tRosa, body: { actual: CLAVE, nueva: "nueva-clave-1" } });
    tNuevo = r.datos?.token;
    const viejo = await http("GET", "/auth/perfil", { token: tRosa });
    const nuevo = await http("GET", "/auth/perfil", { token: tNuevo });
    return { ok: r.status === 200 && viejo.status === 401 && nuevo.status === 200, obtenido: `${r.status} · viejo ${viejo.status} · nuevo ${nuevo.status}` };
  });

  await caso("PF07", "Después del cambio solo entra la contraseña nueva", "anterior 401 · nueva 200", async () => {
    const anterior = await http("POST", "/auth/login", { body: { email: "rosa@finca.ec", password: CLAVE } });
    const nueva = await http("POST", "/auth/login", { body: { email: "rosa@finca.ec", password: "nueva-clave-1" } });
    return { ok: anterior.status === 401 && nueva.status === 200, obtenido: `anterior ${anterior.status} · nueva ${nueva.status}` };
  });
};


// ==========================================================
// INFORME
// ==========================================================

const escribirInforme = (base, inicio) => {
  const carpeta = path.join(__dirname, "resultados");
  fs.mkdirSync(carpeta, { recursive: true });

  const ahora = new Date();
  const sello = ahora.toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
  const archivo = path.join(carpeta, `integracion-${sello}.md`);

  const aprobados = resultados.filter((r) => r.ok).length;
  const celda = (t) => String(t ?? "").replace(/\|/g, "/").replace(/\n/g, " ");

  let md = "# Informe de pruebas de integración de la API\n\n";
  md += `- **Sistema:** RutaCacao · trazabilidad de cacao fino de aroma\n`;
  md += `- **Fecha:** ${ahora.toLocaleString("es-EC")}\n`;
  md += `- **Base de datos de pruebas:** ${base} (se crea vacía y ${CONSERVAR ? "se conservó" : "se eliminó"} al terminar)\n`;
  md += `- **Node.js:** ${process.version}\n`;
  md += `- **Duración:** ${((Date.now() - inicio) / 1000).toFixed(1)} s\n`;
  md += `- **Resultado:** ${aprobados} de ${resultados.length} casos aprobados\n`;

  let actual = "";
  for (const r of resultados) {
    if (r.grupo !== actual) {
      actual = r.grupo;
      md += `\n## ${actual}\n\n| ID | Caso | Esperado | Obtenido | Resultado |\n|---|---|---|---|---|\n`;
    }
    md += `| ${r.id} | ${celda(r.descripcion)} | ${celda(r.esperado)} | ${celda(r.obtenido)} | ${r.ok ? "Aprobado" : "**Fallido**"} |\n`;
  }

  fs.writeFileSync(archivo, md, "utf8");
  return archivo;
};


// ==========================================================
// PRINCIPAL
// ==========================================================

(async () => {
  const inicio = Date.now();
  let servidor;
  let base;
  let codigoSalida = 0;

  try {
    base = await prepararBase();
    console.log(`Base de pruebas: ${base}`);

    servidor = await iniciarServidor();
    console.log(`Servidor de pruebas en ${API}`);

    await ejecutarCasos();

  } catch (error) {
    console.error(`\nLa ejecución se detuvo: ${error.message}`);
    codigoSalida = 1;
  } finally {
    if (servidor) servidor.kill();

    if (mongoose.connection.readyState === 1) {
      if (!CONSERVAR) await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  }

  if (resultados.length) {
    const aprobados = resultados.filter((r) => r.ok).length;
    const archivo = escribirInforme(base, inicio);
    console.log(`\n${aprobados} de ${resultados.length} casos aprobados`);
    console.log(`Informe: ${path.relative(BACKEND, archivo)}`);
    if (aprobados < resultados.length) codigoSalida = 1;
  }

  process.exit(codigoSalida);
})();
