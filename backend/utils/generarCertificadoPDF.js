const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { datosEmpresa } = require("./empresa");
const { aQuintales } = require("./cantidades");
const {
  NORMA,
  PARAMETROS,
  REQUISITOS_GENERALES,
  textoLimite
} = require("./normaInen176");

// Texto del documento con la norma (copia pública de ANECACAO)
const URL_TEXTO_NORMA =
  "https://anecacao.com/wp-content/uploads/2024/04/NTE-INEN-176-SEXTA-REVISION-1.pdf";

const numero = (v) => String(v).replace(".", ",");

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


const generarCertificadoPDF = async (certificacion, { urlVerificacion, urlNorma }) => {

  // Si no se indica, se arma con la misma dirección del sistema
  const enlaceNorma = urlNorma ||
    urlVerificacion.replace(/\/verificar\/.*$/, "/normativa/inen-176");
  const analisis = certificacion.datosCertificacion?.analisisInen;
  const conAnalisis = Boolean(analisis && analisis.grado);

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
      (conAnalisis
        ? `fue inspeccionado y cumple los requisitos de la ${NORMA.codigo} «${NORMA.titulo}», ` +
          `con clasificación GRADO ${analisis.grado}.`
        : "fue inspeccionado y cumple los requisitos de la certificación indicada."),
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
    ...(conAnalisis
      ? [
        ["Norma de referencia", `${NORMA.codigo} · ${NORMA.titulo}`],
        ["Clasificación", `Grado ${analisis.grado} (detalle en el anexo técnico)`]
      ]
      : []),
    ["Resultado de la inspección", certificacion.datosCertificacion?.resultadoInspeccion || "Cumple los requisitos"],
    ["Fecha de emisión", fechaLarga(certificacion.fechaEmision)],
    ["Válido hasta", fechaLarga(certificacion.fechaVencimiento)],
    ["Certificador", nombre(certificacion.certificador)]
  ];

  let y = 270;
  const COL = 170;
  // Con dos filas más (norma y grado) las filas son un poco más bajas
  const ALTO = conAnalisis ? 23 : 26;

  doc.rect(X, y - 8, ANCHO_UTIL, filas.length * ALTO + 12).lineWidth(0.6).strokeColor(COLOR.linea).stroke();

  filas.forEach(([etiqueta, valor], i) => {
    if (i % 2 === 0) {
      doc.rect(X + 0.5, y - 4, ANCHO_UTIL - 1, ALTO).fill("#f7faf8");
    }
    doc.fillColor(COLOR.gris).font("Helvetica").fontSize(9.5)
      .text(etiqueta, X + 14, y + (ALTO - 18) / 2 + 1, { width: COL - 20 });
    doc.fillColor(COLOR.texto).font("Helvetica-Bold").fontSize(10.5)
      .text(valor, X + COL, y + (ALTO - 18) / 2, { width: ANCHO_UTIL - COL - 14, height: 16, ellipsis: true });
    y += ALTO;
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
  const pie = () => {
    doc.moveTo(X, 790).lineTo(ANCHO - X, 790).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
  doc.fillColor(COLOR.gris).font("Helvetica").fontSize(7.5)
    .text(
      "La validez de este documento se comprueba en el enlace de verificación o escaneando el código QR: " +
      "allí se puede confirmar que esta copia es idéntica a la que el certificador firmó y registró en RutaCacao.",
      X, 798, { width: ANCHO_UTIL, align: "center", lineGap: 1 }
    );
  };

  pie();


  // ---------- Anexo técnico: análisis según la NTE INEN 176 ----------
  if (conAnalisis) {
    doc.addPage({ size: "A4", margin: 0 });

    doc.rect(0, 0, ANCHO, 56).fill(COLOR.cacao);
    doc.rect(0, 56, ANCHO, 3).fill(COLOR.mazorca);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(13)
      .text("Anexo técnico", X, 18);
    doc.font("Helvetica").fontSize(9).fillColor("#e3d4c5")
      .text(`Certificado ${certificacion.codigo || ""} · lote ${lote.codigo || ""}`, X, 36);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("white")
      .text(NORMA.codigo, X, 24, { width: ANCHO_UTIL, align: "right" });

    let ay = 82;
    doc.fillColor(COLOR.verdeOscuro).font("Helvetica-Bold").fontSize(14)
      .text(`Análisis de calidad según la ${NORMA.codigo}`, X, ay);
    ay += 22;
    doc.fillColor(COLOR.texto).font("Helvetica").fontSize(9.5)
      .text(
        `Base técnica: Norma Técnica Ecuatoriana ${NORMA.codigo} «${NORMA.titulo}» (${NORMA.revision.toLowerCase()}), ` +
        `emitida por el ${NORMA.entidad}. La norma fija los requisitos de calidad de los granos de cacao ` +
        "y los clasifica en Grado 1, Grado 2 y Grado 3. Cada parámetro del lote se compara con los límites " +
        "de la Tabla 1 de la norma; el grado del lote es el del parámetro con la peor clasificación.",
        X, ay, { width: ANCHO_UTIL, lineGap: 2, align: "justify" }
      );
    ay = doc.y + 8;
    doc.fillColor(COLOR.gris).fontSize(8.5)
      .text(`Fecha del análisis: ${fechaLarga(analisis.fechaAnalisis)} · Certificador: ${nombre(certificacion.certificador)}`, X, ay);
    ay = doc.y + 12;

    // Tabla de parámetros
    const cols = [
      { t: "Parámetro", w: 150 },
      { t: "Resultado", w: 62, a: "center" },
      { t: "Grado 1", w: 62, a: "center" },
      { t: "Grado 2", w: 66, a: "center" },
      { t: "Grado 3", w: 62, a: "center" },
      { t: "Método", w: ANCHO_UTIL - 402 }
    ];
    const fila = (celdas, { cabecera = false, fondo = null, alto = 26, resaltar = null } = {}) => {
      if (fondo) doc.rect(X, ay, ANCHO_UTIL, alto).fill(fondo);
      let cx = X;
      cols.forEach((c, i) => {
        if (resaltar === i) {
          doc.roundedRect(cx + 3, ay + 3, c.w - 6, alto - 6, 3).fill("#c6f6d5");
        }
        doc.fillColor(cabecera ? "white" : (i === 5 ? COLOR.gris : COLOR.texto))
          .font(cabecera || i === 1 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(cabecera ? 8.5 : i === 5 ? 7.5 : 8.5);
        // centrado vertical según el alto real del texto
        const altoTexto = doc.heightOfString(celdas[i], { width: c.w - 10 });
        doc.text(celdas[i], cx + 5, ay + (alto - altoTexto) / 2 + 1, { width: c.w - 10, align: c.a || "left", lineGap: 0 });
        cx += c.w;
      });
      ay += alto;
    };

    fila(cols.map((c) => c.t), { cabecera: true, fondo: COLOR.verdeOscuro, alto: 22 });
    PARAMETROS.forEach((p, i) => {
      const valor = analisis[p.clave];
      // grado que obtuvo este parámetro (para resaltar la columna)
      const g = [0, 1, 2].find((k) =>
        p.tipo === "max" ? valor <= p.limites[k]
          : p.tipo === "min" ? valor >= p.limites[k]
            : k === 0 ? valor > 130 : k === 1 ? valor > 120 : valor >= 100);
      fila([
        p.nombre,
        `${numero(valor)} ${p.unidad}`,
        textoLimite(p, 0),
        textoLimite(p, 1),
        textoLimite(p, 2),
        p.metodo
      ], { fondo: i % 2 === 0 ? "#f7faf8" : null, resaltar: g === undefined ? null : 2 + g });
    });
    doc.rect(X, ay - 22 - PARAMETROS.length * 26, ANCHO_UTIL, 22 + PARAMETROS.length * 26)
      .lineWidth(0.6).strokeColor(COLOR.linea).stroke();

    ay += 8;
    doc.fillColor(COLOR.gris).font("Helvetica").fontSize(7.5)
      .text("La casilla resaltada indica el mejor grado que cumple cada parámetro.", X, ay);
    ay += 18;

    // Requisitos generales
    doc.fillColor(COLOR.verdeOscuro).font("Helvetica-Bold").fontSize(10)
      .text("Requisitos generales (sección 5 de la norma)", X, ay);
    ay += 16;
    REQUISITOS_GENERALES.forEach((r) => {
      const ok = analisis[r.clave] === true;
      doc.fillColor(ok ? COLOR.verde : "#c53030").font("Helvetica-Bold").fontSize(9)
        .text(ok ? "Cumple" : "No cumple", X, ay, { width: 60 });
      doc.fillColor(COLOR.texto).font("Helvetica").fontSize(9)
        .text(r.nombre, X + 64, ay, { width: ANCHO_UTIL - 64 });
      ay += 15;
    });

    // Resultado
    ay += 10;
    doc.roundedRect(X, ay, ANCHO_UTIL, 46, 6).fill("#f0fff4");
    doc.roundedRect(X, ay, ANCHO_UTIL, 46, 6).lineWidth(0.8).strokeColor("#9ae6b4").stroke();
    doc.fillColor(COLOR.verdeOscuro).font("Helvetica-Bold").fontSize(13)
      .text(`Resultado: CUMPLE · GRADO ${analisis.grado}`, X + 14, ay + 9);
    doc.fillColor(COLOR.texto).font("Helvetica").fontSize(8.5)
      .text(
        `Todos los parámetros están dentro de los límites del Grado ${analisis.grado} o mejores, ` +
        "y se cumplen los requisitos generales de la norma.",
        X + 14, ay + 27, { width: ANCHO_UTIL - 28 }
      );
    ay += 66;

    // Enlaces a la norma y a los parámetros
    doc.fillColor(COLOR.verdeOscuro).font("Helvetica-Bold").fontSize(10)
      .text("Norma, bases y parámetros aplicados", X, ay);
    ay += 15;
    doc.fillColor(COLOR.texto).font("Helvetica").fontSize(9)
      .text("Consulte en línea la norma, la tabla de requisitos y cómo se calcula el grado:", X, ay, { width: ANCHO_UTIL });
    ay = doc.y + 3;
    doc.fillColor(COLOR.verde).font("Helvetica-Bold").fontSize(9)
      .text(enlaceNorma, X, ay, { width: ANCHO_UTIL, link: enlaceNorma, underline: true });
    ay = doc.y + 8;
    doc.fillColor(COLOR.texto).font("Helvetica").fontSize(9)
      .text(`Texto de la ${NORMA.codigo}:`, X, ay, { width: ANCHO_UTIL });
    ay = doc.y + 3;
    doc.fillColor(COLOR.verde).font("Helvetica").fontSize(8)
      .text(URL_TEXTO_NORMA, X, ay, { width: ANCHO_UTIL, link: URL_TEXTO_NORMA, underline: true });

    pie();
  }

  doc.end();
  return terminado;
};


module.exports = generarCertificadoPDF;
module.exports.palabrasClave = palabrasClave;
