// ==========================================================
// ANÁLISIS DE LA FIRMA ELECTRÓNICA DE UN PDF
// ----------------------------------------------------------
// Revisa un PDF firmado (por ejemplo con FirmaEC o Adobe)
// sin usar librerías externas:
//   1. Que tenga al menos una firma digital incrustada.
//   2. Que la última firma cubra TODO el archivo, es decir,
//      que nada se haya agregado o cambiado después de firmar.
//   3. Que el resumen (hash) guardado dentro de cada firma
//      coincida con el contenido firmado (integridad).
//   4. Quién firmó (nombre del certificado), quién emitió el
//      certificado y en qué fecha se firmó.
//
// NO comprueba la cadena de confianza del certificado hasta
// la entidad de certificación ni si fue revocado: eso lo
// hacen FirmaEC o Adobe Acrobat Reader al abrir el archivo.
// ==========================================================

const crypto = require("crypto");


// ---------- Lector DER/BER mínimo ----------

const leerTLV = (buf, pos) => {
  const inicio = pos;
  const tag = buf[pos++];
  let largo = buf[pos++];
  let indefinido = false;

  if (largo === 0x80) {
    indefinido = true;
    largo = null;
  } else if (largo & 0x80) {
    const bytes = largo & 0x7f;
    if (bytes > 4) throw new Error("Longitud DER no soportada");
    largo = 0;
    for (let i = 0; i < bytes; i++) largo = largo * 256 + buf[pos++];
  }

  const constructed = (tag & 0x20) !== 0;
  const nodo = { tag, inicio, contenido: pos, hijos: null };

  if (indefinido) {
    // Hijos hasta encontrar 00 00
    nodo.hijos = [];
    let p = pos;
    while (!(buf[p] === 0 && buf[p + 1] === 0)) {
      const hijo = leerTLV(buf, p);
      nodo.hijos.push(hijo);
      p = hijo.fin;
    }
    nodo.valor = buf.subarray(pos, p);
    nodo.fin = p + 2;
    return nodo;
  }

  nodo.valor = buf.subarray(pos, pos + largo);
  nodo.fin = pos + largo;

  if (nodo.fin > buf.length) throw new Error("Estructura DER incompleta");

  if (constructed) {
    nodo.hijos = [];
    let p = pos;
    while (p < nodo.fin) {
      const hijo = leerTLV(buf, p);
      nodo.hijos.push(hijo);
      p = hijo.fin;
    }
  }

  return nodo;
};

const oid = (nodo) => {
  const b = nodo.valor;
  const partes = [Math.floor(b[0] / 40), b[0] % 40];
  let valor = 0;
  for (let i = 1; i < b.length; i++) {
    valor = valor * 128 + (b[i] & 0x7f);
    if (!(b[i] & 0x80)) {
      partes.push(valor);
      valor = 0;
    }
  }
  return partes.join(".");
};

const texto = (nodo) => {
  if (!nodo) return "";
  if (nodo.tag === 0x1e) {
    // BMPString (UTF-16BE)
    let s = "";
    for (let i = 0; i + 1 < nodo.valor.length; i += 2) {
      s += String.fromCharCode(nodo.valor.readUInt16BE(i));
    }
    return s;
  }
  return nodo.valor.toString("utf8");
};

const fecha = (nodo) => {
  const s = nodo.valor.toString("latin1");
  let anio, resto;
  if (nodo.tag === 0x17) {
    // UTCTime AAMMDDhhmmssZ
    const aa = Number(s.slice(0, 2));
    anio = aa >= 50 ? 1900 + aa : 2000 + aa;
    resto = s.slice(2);
  } else {
    // GeneralizedTime AAAAMMDDhhmmssZ
    anio = Number(s.slice(0, 4));
    resto = s.slice(4);
  }
  const [mes, dia, hora, min, seg] = [0, 2, 4, 6, 8].map((i) => Number(resto.slice(i, i + 2)) || 0);
  return new Date(Date.UTC(anio, mes - 1, dia, hora, min, seg));
};

const OID = {
  signedData: "1.2.840.113549.1.7.2",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  commonName: "2.5.4.3",
  serialNumber: "2.5.4.5",
  organization: "2.5.4.10"
};

const ALGORITMOS = {
  "1.3.14.3.2.26": "sha1",
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512"
};

// Name = SEQUENCE OF SET OF { OID, valor }
const leerNombre = (nodo) => {
  const datos = {};
  for (const rdn of nodo.hijos || []) {
    for (const atv of rdn.hijos || []) {
      const clave = oid(atv.hijos[0]);
      const valor = texto(atv.hijos[1]);
      if (clave === OID.commonName) datos.cn = datos.cn || valor;
      if (clave === OID.serialNumber) datos.serial = datos.serial || valor;
      if (clave === OID.organization) datos.o = datos.o || valor;
    }
  }
  return datos;
};

// Certificate → { serial, emisor, sujeto, desde, hasta }
const leerCertificado = (nodo) => {
  const tbs = nodo.hijos[0];
  let i = 0;
  if (tbs.hijos[0].tag === 0xa0) i = 1; // versión explícita
  const serial = tbs.hijos[i].valor.toString("hex");
  const emisor = leerNombre(tbs.hijos[i + 2]);
  const validez = tbs.hijos[i + 3];
  const sujeto = leerNombre(tbs.hijos[i + 4]);
  return {
    serial,
    emisor,
    sujeto,
    desde: fecha(validez.hijos[0]),
    hasta: fecha(validez.hijos[1])
  };
};


// ---------- Análisis de una firma CMS/PKCS#7 ----------

const analizarCMS = (der, datosFirmados) => {
  const raiz = leerTLV(der, 0);

  if (oid(raiz.hijos[0]) !== OID.signedData) {
    throw new Error("La firma no es de tipo PKCS#7/CMS");
  }

  const signedData = raiz.hijos[1].hijos[0];
  const hijos = signedData.hijos;

  const certificados = (hijos.find((h) => h.tag === 0xa0)?.hijos || [])
    .filter((c) => c.tag === 0x30)
    .map(leerCertificado);

  const signerInfos = hijos[hijos.length - 1];
  const signer = signerInfos.hijos[0];

  // Identificador del firmante: emisor + número de serie
  const sid = signer.hijos[1];
  let certificado = null;
  if (sid.tag === 0x30) {
    const serial = sid.hijos[1].valor.toString("hex");
    certificado = certificados.find((c) => c.serial === serial) || null;
  }
  certificado = certificado || certificados[0] || null;

  const algoritmo = ALGORITMOS[oid(signer.hijos[2].hijos[0])] || null;

  // Atributos firmados: messageDigest y signingTime
  const atributos = signer.hijos.find((h) => h.tag === 0xa0);
  let resumen = null;
  let fechaFirma = null;

  for (const atributo of atributos?.hijos || []) {
    const tipo = oid(atributo.hijos[0]);
    const valor = atributo.hijos[1].hijos[0];
    if (tipo === OID.messageDigest) resumen = valor.valor;
    if (tipo === OID.signingTime) fechaFirma = fecha(valor);
  }

  let integridad = null; // null = no se pudo comprobar
  if (resumen && algoritmo) {
    const calculado = crypto.createHash(algoritmo).update(datosFirmados).digest();
    integridad = calculado.equals(resumen);
  }

  return {
    firmante: certificado?.sujeto.cn || "",
    identificacion: certificado?.sujeto.serial || "",
    organizacion: certificado?.sujeto.o || "",
    emisor: certificado?.emisor.cn || certificado?.emisor.o || "",
    certificadoDesde: certificado?.desde || null,
    certificadoHasta: certificado?.hasta || null,
    fechaFirma,
    algoritmo,
    integridad
  };
};


// ---------- Análisis del PDF ----------

const analizarFirmaPdf = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, motivo: "El archivo no es un PDF" };
  }

  const contenido = buffer.toString("latin1");
  const patron = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const firmas = [];
  let encontrado;

  while ((encontrado = patron.exec(contenido)) !== null) {
    const [a, b, c, d] = encontrado.slice(1).map(Number);

    if (a !== 0 || b <= 0 || c <= b || c + d > buffer.length) {
      continue; // no es un rango válido (por ejemplo, un marcador vacío)
    }

    const hex = buffer.subarray(b, c).toString("latin1").replace(/[<>\s]/g, "");
    if (!/^[0-9a-fA-F]+$/.test(hex) || /^0+$/.test(hex)) continue;

    const datosFirmados = Buffer.concat([buffer.subarray(a, a + b), buffer.subarray(c, c + d)]);
    const restante = buffer.subarray(c + d).toString("latin1");

    try {
      firmas.push({
        ...analizarCMS(Buffer.from(hex, "hex"), datosFirmados),
        cubreTodo: /^\s*$/.test(restante)
      });
    } catch (error) {
      firmas.push({ error: error.message, integridad: false, cubreTodo: false });
    }
  }

  if (firmas.length === 0) {
    return {
      ok: false,
      motivo: "El PDF no tiene una firma electrónica. Fírmalo con FirmaEC u otro firmador y vuelve a subirlo."
    };
  }

  if (firmas.some((f) => f.error)) {
    return { ok: false, motivo: "No se pudo leer la firma electrónica del PDF", firmas };
  }

  if (firmas.some((f) => f.integridad === false)) {
    return { ok: false, motivo: "El contenido del PDF no coincide con su firma: el documento fue alterado", firmas };
  }

  const ultima = firmas[firmas.length - 1];

  if (!ultima.cubreTodo) {
    return { ok: false, motivo: "El PDF fue modificado después de firmarlo", firmas };
  }

  return { ok: true, firmas, firma: ultima };
};


// ---------- Comprobaciones adicionales ----------

// El PDF es el de esta certificación: el generador pone el
// identificador y el código en las propiedades del PDF.
const perteneceACertificacion = (buffer, certificacion) => {
  const contenido = buffer.toString("latin1");
  return contenido.includes(String(certificacion._id)) ||
    Boolean(certificacion.codigo && contenido.includes(certificacion.codigo));
};

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

// ¿El nombre del certificado corresponde a la persona?
// Basta con que aparezcan su primer nombre y su primer apellido.
const nombreCoincide = (firmante, persona) => {
  if (!firmante || !persona) return false;
  const cn = normalizar(firmante);
  const nombre = normalizar(persona.nombre).split(/\s+/)[0];
  const apellido = normalizar(persona.apellido).split(/\s+/)[0];
  return Boolean(nombre && apellido && cn.includes(nombre) && cn.includes(apellido));
};


module.exports = {
  perteneceACertificacion,
  nombreCoincide,
  analizarFirmaPdf,
  leerTLV,
  oid
};
