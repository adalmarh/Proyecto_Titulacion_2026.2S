const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { datosEmpresa } = require("./empresa");
const { aQuintales } = require("./cantidades");

// "1.200 kg (26,5 qq aprox.) de cacao seco"
// (sin el signo ≈: la fuente estándar del PDF no lo tiene)
const textoCantidad = (lote) => {
  if (lote.cantidad == null) return "—";
  const kg = Number(lote.cantidad);
  const grano = lote.estadoGrano === "baba" ? "en baba" : "seco";
  return `${kg.toLocaleString("es-EC")} kg (${aQuintales(kg).toLocaleString("es-EC")} qq aprox.) de cacao ${grano}`;
};


// ==========================================================
// CERTIFICADO PDF DE UNA CERTIFICACIÓN APROBADA
// ----------------------------------------------------------
// Genera el documento que el certificador descarga y firma:
// a mano (impreso y escaneado), en Word, o electrónicamente
// con FirmaEC (opcional). Incluye:
//   - Los datos del lote, del productor y de la certificación.
//   - Un QR que lleva a la página pública de verificación.
//   - Un recuadro reservado para el sello de la firma.
//   - En las propiedades del PDF (Palabras clave), el
//     identificador de la certificación: así el sistema
//     comprueba que un PDF con firma electrónica es este mismo.
// Devuelve una promesa con el PDF en un Buffer.
// ==========================================================

const COLOR = {
  cacao: "#3b2418",
  verde: "#2f855a",
  verdeOscuro: "#1f4d3a",
  gris: "#6b7280",
  texto: "#1f2937",
  linea: "#d1d5db",
  mazorca: "#e0a42f"
};

const fechaLarga = (valor) =>
  valor
    ? new Date(valor).toLocaleDateString("es-EC", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    })
    : "No definida";

const nombre = (persona) =>
  persona ? `${persona.nombre || ""} ${persona.apellido || ""}`.trim() : "—";


// Palabras clave que identifican el certificado dentro del PDF
const palabrasClave = (certificacion) =>
  `RutaCacao ${certificacion.codigo || ""} ${certificacion._id}`.trim();


const generarCertificadoPDF = async (certificacion, { urlVerificacion }) => {

  const lote = certificacion.lote || {};
  const productor = lote.productor || {};
  const empresa = datosEmpresa();
  const ubicacion = lote.ubicacion || {};

  const qr = await QRCode.toBuffer(urlVerificacion, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M"
  });

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    info: {
      Title: `Certificado ${certificacion.codigo || ""} - ${certificacion.tipoCertificacion}`,
      Author: `${empresa.nombre} · RutaCacao`,
      Subject: `Certificación de cacao fino de aroma del lote ${lote.codigo || ""}`,
      Keywords: palabrasClave(certificacion)
    }
  });

  const partes = [];
  doc.on("data", (parte) => partes.push(parte));
  const terminado = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(partes))));

  const ANCHO = doc.page.width;   // 595
  const X = 56;
  const ANCHO_UTIL = ANCHO - X * 2;


  // ---------- Encabezado ----------
  doc.rect(0, 0, ANCHO, 92).fill(COLOR.cacao);
  doc.rect(0, 92, ANCHO, 4).fill(COLOR.mazorca);

  doc.fillColor("white").font("Helvetica-Bold").fontSize(20)
    .text("RutaCacao", X, 30);
  doc.font("Helvetica").fontSize(10).fillColor("#e3d4c5")
    .text("Trazabilidad y certificación de cacao fino de aroma", X, 56);

  doc.font("Helvetica-Bold").fontSize(10).fillColor("white")
    .text(certificacion.codigo || "", X, 32, { width: ANCHO_UTIL, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#e3d4c5")
    .text("Código del certificado", X, 48, { width: ANCHO_UTIL, align: "right" });


  // ---------- Título ----------
  doc.fillColor(COLOR.verdeOscuro).font("Helvetica-Bold").fontSize(22)
    .text("CERTIFICADO", X, 128, { width: ANCHO_UTIL, align: "center", characterSpacing: 2 });
  doc.fillColor(COLOR.texto).font("Helvetica").fontSize(14)
    .text(certificacion.tipoCertificacion || "", X, 158, { width: ANCHO_UTIL, align: "center" });

  doc.moveTo(X + 150, 186).lineTo(ANCHO - X - 150, 186).lineWidth(1).strokeColor(COLOR.mazorca).stroke();

  doc.fillColor(COLOR.texto).font("Helvetica").fontSize(11)
    .text(
      `Se certifica que el lote ${lote.codigo || ""} de ${(lote.producto || "cacao fino de aroma").toLowerCase()}, ` +
      `producido por ${nombre(productor)}, productor de ${empresa.nombre}, ` +
      "fue inspeccionado y cumple los requisitos de la certificación indicada.",
      X, 204, { width: ANCHO_UTIL, align: "center", lineGap: 3 }
    );


  // ---------- Datos ----------
  const filas = [
    ["Lote", lote.codigo || "—"],
    ["Producto", lote.producto || "Cacao fino de aroma"],
    ["Cantidad", textoCantidad(lote)],
    ["Origen", [ubicacion.parroquia, ubicacion.canton, ubicacion.provincia].filter(Boolean).join(", ") || "—"],
    ["Productor", nombre(productor)],
    ["Empresa", [empresa.nombre, empresa.ruc && `RUC ${empresa.ruc}`].filter(Boolean).join(" · ")],
    ["Resultado de la inspección", certificacion.datosCertificacion?.resultadoInspeccion || "Cumple los requisitos"],
    ["Fecha de emisión", fechaLarga(certificacion.fechaEmision)],
    ["Válido hasta", fechaLarga(certificacion.fechaVencimiento)],
    ["Certificador", nombre(certificacion.certificador)]
  ];

  let y = 270;
  const COL = 170;

  doc.rect(X, y - 8, ANCHO_UTIL, filas.length * 26 + 12).lineWidth(0.6).strokeColor(COLOR.linea).stroke();

  filas.forEach(([etiqueta, valor], i) => {
    if (i % 2 === 0) {
      doc.rect(X + 0.5, y - 4, ANCHO_UTIL - 1, 26).fill("#f7faf8");
    }
    doc.fillColor(COLOR.gris).font("Helvetica").fontSize(9.5)
      .text(etiqueta, X + 14, y + 4, { width: COL - 20 });
    doc.fillColor(COLOR.texto).font("Helvetica-Bold").fontSize(10.5)
      .text(valor, X + COL, y + 3, { width: ANCHO_UTIL - COL - 14, height: 16, ellipsis: true });
    y += 26;
  });

  if (certificacion.observaciones) {
    y += 14;
    doc.fillColor(COLOR.gris).font("Helvetica").fontSize(9.5)
      .text("Observaciones", X, y);
    doc.fillColor(COLOR.texto).fontSize(10)
      .text(certificacion.observaciones, X, y + 14, { width: ANCHO_UTIL, height: 42, ellipsis: true });
  }


  // ---------- Verificación (QR) ----------
  const Y_PIE = 648;

  doc.image(qr, X, Y_PIE, { width: 96 });
  doc.fillColor(COLOR.verdeOscuro).font("Helvetica-Bold").fontSize(10)
    .text("Verifique este certificado", X + 108, Y_PIE + 8, { width: 170 });
  doc.fillColor(COLOR.gris).font("Helvetica").fontSize(8.5)
    .text(
      "Escanee el código o abra el enlace para comprobar que el certificado existe, " +
      "si está vigente y si fue firmado por el certificador.",
      X + 108, Y_PIE + 24, { width: 170, lineGap: 1.5 }
    );
  doc.fillColor(COLOR.verde).fontSize(7.5)
    .text(urlVerificacion, X + 108, Y_PIE + 74, { width: 170, link: urlVerificacion, underline: false });


  // ---------- Recuadro para la firma del certificador ----------
  // Queda en blanco para firmar a mano o colocar la firma.
  const FX = ANCHO - X - 200;

  doc.roundedRect(FX, Y_PIE, 200, 84, 6).dash(3, { space: 3 }).lineWidth(0.8).strokeColor("#9ca3af").stroke();
  doc.undash();
  doc.fillColor("#9ca3af").font("Helvetica").fontSize(7)
    .text("Firma", FX + 8, Y_PIE + 72, { width: 184, align: "left" });

  doc.fillColor(COLOR.texto).font("Helvetica-Bold").fontSize(10)
    .text(nombre(certificacion.certificador), FX, Y_PIE + 92, { width: 200, align: "center" });
  doc.fillColor(COLOR.gris).font("Helvetica").fontSize(9)
    .text("Certificador", FX, Y_PIE + 106, { width: 200, align: "center" });


  // ---------- Pie ----------
  doc.moveTo(X, 790).lineTo(ANCHO - X, 790).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
  doc.fillColor(COLOR.gris).font("Helvetica").fontSize(7.5)
    .text(
      "La validez de este documento se comprueba en el enlace de verificación o escaneando el código QR: " +
      "allí se puede confirmar que esta copia es idéntica a la que el certificador firmó y registró en RutaCacao.",
      X, 798, { width: ANCHO_UTIL, align: "center", lineGap: 1 }
    );

  doc.end();
  return terminado;
};


module.exports = generarCertificadoPDF;
module.exports.palabrasClave = palabrasClave;
