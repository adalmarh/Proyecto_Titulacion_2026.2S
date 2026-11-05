// ==========================================================
// FIRMAR UN PDF CON EL CERTIFICADO DE PRUEBA
// ----------------------------------------------------------
// SOLO PARA PRUEBAS Y DEMOSTRACIONES. Agrega al PDF una
// firma electrónica real (formato PAdES / PKCS#7) hecha con
// un certificado de PRUEBA emitido por sí mismo
// (pruebas/fixtures/certificado-prueba.pem). FirmaEC y Adobe
// la mostrarán como "no confiable" porque no la emitió una
// entidad acreditada, pero sirve para probar el flujo.
// En la vida real el certificador firma con FirmaEC y su
// certificado; el sistema nunca recibe su clave.
//
// Uso, desde la carpeta backend:
//   node scripts/firmarPdfPrueba.js CERT-2026-00001.pdf
//   (crea CERT-2026-00001-firmado-prueba.pdf)
// ==========================================================

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { leerTLV } = require("../utils/firmaPdf");

const FIXTURES = path.join(__dirname, "..", "pruebas", "fixtures");


// ---------- Codificación DER ----------

const largo = (n) => {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
};

const tlv = (tag, ...partes) => {
  const contenido = Buffer.concat(partes);
  return Buffer.concat([Buffer.from([tag]), largo(contenido.length), contenido]);
};

const oidDer = (texto) => {
  const n = texto.split(".").map(Number);
  const bytes = [n[0] * 40 + n[1]];
  for (const valor of n.slice(2)) {
    const parte = [valor & 0x7f];
    let v = valor >> 7;
    while (v > 0) { parte.unshift((v & 0x7f) | 0x80); v >>= 7; }
    bytes.push(...parte);
  }
  return tlv(0x06, Buffer.from(bytes));
};

const SEQ = (...p) => tlv(0x30, ...p);
const SET = (...p) => tlv(0x31, ...p);
const NULO = Buffer.from([0x05, 0x00]);

const utcTime = (fecha) => {
  const d = (n) => String(n).padStart(2, "0");
  const s = `${d(fecha.getUTCFullYear() % 100)}${d(fecha.getUTCMonth() + 1)}${d(fecha.getUTCDate())}` +
    `${d(fecha.getUTCHours())}${d(fecha.getUTCMinutes())}${d(fecha.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(s, "latin1"));
};


// ---------- CMS SignedData (firma separada) ----------

const firmaCMS = (datos, certPem, clavePem, fecha = new Date()) => {
  const certDer = Buffer.from(certPem.replace(/-----[^-]+-----|\s/g, ""), "base64");
  const tbs = leerTLV(certDer, 0).hijos[0];
  const i = tbs.hijos[0].tag === 0xa0 ? 1 : 0;
  const serial = tbs.hijos[i];
  const emisor = tbs.hijos[i + 2];
  const crudo = (n) => certDer.subarray(n.inicio, n.fin);

  const sha256 = SEQ(oidDer("2.16.840.1.101.3.4.2.1"), NULO);
  const resumen = crypto.createHash("sha256").update(datos).digest();

  const atributos = [
    SEQ(oidDer("1.2.840.113549.1.9.3"), SET(oidDer("1.2.840.113549.1.7.1"))),
    SEQ(oidDer("1.2.840.113549.1.9.5"), SET(utcTime(fecha))),
    SEQ(oidDer("1.2.840.113549.1.9.4"), SET(tlv(0x04, resumen)))
  ];

  const firma = crypto.sign("sha256", SET(...atributos), clavePem);

  const signerInfo = SEQ(
    tlv(0x02, Buffer.from([1])),
    SEQ(crudo(emisor), crudo(serial)),
    sha256,
    tlv(0xa0, ...atributos),
    SEQ(oidDer("1.2.840.113549.1.1.1"), NULO),
    tlv(0x04, firma)
  );

  const signedData = SEQ(
    tlv(0x02, Buffer.from([1])),
    SET(sha256),
    SEQ(oidDer("1.2.840.113549.1.7.1")),
    tlv(0xa0, certDer),
    SET(signerInfo)
  );

  return SEQ(oidDer("1.2.840.113549.1.7.2"), tlv(0xa0, signedData));
};


// ---------- Firma incremental del PDF ----------
// Agrega (sin tocar lo anterior) el diccionario de firma,
// un campo de firma en la primera página y el formulario
// (AcroForm) en el catálogo, como hacen FirmaEC o Adobe.

const objetoTexto = (texto, numero) => {
  const m = new RegExp(`(?:^|\\s)${numero} 0 obj\\s*([\\s\\S]*?)\\s*endobj`).exec(texto);
  if (!m) throw new Error(`No se encontró el objeto ${numero}`);
  return m[1].trim();
};

const firmarPdfPrueba = (pdf, opciones = {}) => {
  const certPem = opciones.certPem || fs.readFileSync(path.join(FIXTURES, "certificado-prueba.pem"), "utf8");
  const clavePem = opciones.clavePem || fs.readFileSync(path.join(FIXTURES, "clave-prueba.pem"), "utf8");
  const fecha = opciones.fecha || new Date();

  const texto = pdf.toString("latin1");
  const startxref = Number([...texto.matchAll(/startxref\s+(\d+)/g)].pop()[1]);
  const size = Number([...texto.matchAll(/\/Size\s+(\d+)/g)].pop()[1]);
  const raiz = Number([...texto.matchAll(/\/Root\s+(\d+) 0 R/g)].pop()[1]);

  // Catálogo y primera página
  const catalogo = objetoTexto(texto, raiz);
  const paginas = Number(/\/Pages\s+(\d+) 0 R/.exec(catalogo)[1]);
  const pagina = Number(/\/Kids\s*\[\s*(\d+) 0 R/.exec(objetoTexto(texto, paginas))[1]);
  const paginaTexto = objetoTexto(texto, pagina);

  const HEX = 16384;
  const nFirma = size;
  const nCampo = size + 1;
  const vacio = "[0 0000000000 0000000000 0000000000]";

  const sinCierre = (dic) => dic.replace(/>>\s*$/, "");

  const nuevaPagina = /\/Annots\s*\[/.test(paginaTexto)
    ? paginaTexto.replace(/\/Annots\s*\[/, `/Annots [${nCampo} 0 R `)
    : `${sinCierre(paginaTexto)} /Annots [${nCampo} 0 R] >>`;

  const nuevoCatalogo = `${sinCierre(catalogo)} /AcroForm << /Fields [${nCampo} 0 R] /SigFlags 3 >> >>`;

  const objetos = [
    [raiz, nuevoCatalogo],
    [pagina, nuevaPagina],
    [nFirma,
      "<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached " +
      `/ByteRange ${vacio} /Contents <${"0".repeat(HEX)}> /Reason (Firma de prueba RutaCacao) >>`],
    [nCampo,
      `<< /Type /Annot /Subtype /Widget /FT /Sig /T (FirmaCertificador) /F 132 /Rect [0 0 0 0] /P ${pagina} 0 R /V ${nFirma} 0 R >>`]
  ];

  let cuerpo = Buffer.concat([pdf, Buffer.from("\n", "latin1")]);
  const posiciones = {};
  for (const [numero, contenido] of objetos) {
    posiciones[numero] = cuerpo.length;
    cuerpo = Buffer.concat([cuerpo, Buffer.from(`${numero} 0 obj\n${contenido}\nendobj\n`, "latin1")]);
  }

  const xref = ["xref"];
  for (const numero of Object.keys(posiciones).map(Number).sort((a, b) => a - b)) {
    xref.push(`${numero} 1`, `${String(posiciones[numero]).padStart(10, "0")} 00000 n `);
  }
  const cola =
    `${xref.join("\n")}\ntrailer\n<< /Size ${size + 2} /Root ${raiz} 0 R /Prev ${startxref} >>\n` +
    `startxref\n${cuerpo.length}\n%%EOF\n`;

  const total = Buffer.concat([cuerpo, Buffer.from(cola, "latin1")]);

  // Rango de bytes firmado: todo menos el hueco de /Contents
  const c0 = total.indexOf("/Contents <", posiciones[nFirma], "latin1") + "/Contents ".length;
  const c1 = c0 + HEX + 2;
  const rango = `[0 ${String(c0).padStart(10, "0")} ${String(c1).padStart(10, "0")} ${String(total.length - c1).padStart(10, "0")}]`;
  total.write(rango, total.indexOf(vacio, posiciones[nFirma], "latin1"), "latin1");

  const datos = Buffer.concat([total.subarray(0, c0), total.subarray(c1)]);
  const hex = firmaCMS(datos, certPem, clavePem, fecha).toString("hex");

  if (hex.length > HEX) throw new Error("La firma no cabe en el espacio reservado");
  total.write(hex, c0 + 1, "latin1");

  return total;
};


module.exports = { firmarPdfPrueba };


// ---------- Uso desde la consola ----------
if (require.main === module) {
  const entrada = process.argv[2];
  if (!entrada) {
    console.log("Uso: node scripts/firmarPdfPrueba.js archivo.pdf");
    process.exit(1);
  }
  const salida = entrada.replace(/\.pdf$/i, "") + "-firmado-prueba.pdf";
  fs.writeFileSync(salida, firmarPdfPrueba(fs.readFileSync(entrada)));
  console.log(`PDF firmado con el certificado de PRUEBA: ${salida}`);
}
