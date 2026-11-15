// ==========================================================
// ASISTENTE DE IA PARA REDACTAR EL DICTAMEN
// ----------------------------------------------------------
// Usa un modelo de lenguaje (Google Gemini) para PROPONER la
// redacción del «Resultado de la inspección» y de las
// «Observaciones» a partir del análisis según la NTE INEN 176.
//
// Reglas de diseño (humano en el ciclo):
//  - La IA NO decide el grado ni aprueba o rechaza: el grado
//    lo calcula utils/normaInen176.js y la decisión es del
//    certificador.
//  - La IA solo recibe datos técnicos: valores del análisis,
//    grado, tipo de certificación y estado del grano. NUNCA
//    nombres, cédulas, correos ni ubicaciones.
//  - La propuesta no se guarda sola: el certificador la lee,
//    la corrige y decide si la usa.
//
// Configuración (backend/.env):
//   GEMINI_API_KEY=...            clave de Google AI Studio
//   GEMINI_MODELO=gemini-3.5-flash-lite   (opcional)
// ==========================================================

const { NORMA, PARAMETROS, textoLimite } = require("./normaInen176");

const MODELO_POR_DEFECTO = "gemini-3.5-flash-lite";
const URL_API = "https://generativelanguage.googleapis.com/v1beta/models";
const ESPERA_MS = 25000;

// Largo máximo: el resultado va en una fila del PDF
const MAX_RESULTADO = 60;
const MAX_OBSERVACIONES = 700;

class ErrorIA extends Error {
  constructor(mensaje, estado = 502) {
    super(mensaje);
    this.estado = estado;
  }
}

// Se puede reemplazar en las pruebas
const cliente = { fetch: (...args) => globalThis.fetch(...args) };


const iaConfigurada = () => Boolean(process.env.GEMINI_API_KEY);

const numero = (v) => String(v).replace(".", ",");


// ----------------------------------------------------------
// Instrucciones fijas para el modelo
// ----------------------------------------------------------
const INSTRUCCIONES = [
  "Eres un asistente técnico de certificación de cacao fino de aroma en Ecuador.",
  `Ayudas a un certificador humano a redactar el dictamen de un lote según la ${NORMA.codigo} «${NORMA.titulo}».`,
  "Reglas:",
  "1. No cambies ni discutas el grado ni la decisión: ya están calculados con la norma y los decide el certificador.",
  "2. Usa solo los datos recibidos. No inventes fechas, lugares, personas, laboratorios ni valores.",
  `3. «resultado»: una sola frase en español, de máximo ${MAX_RESULTADO} caracteres, sin punto final.`,
  "4. «observaciones»: 2 a 4 oraciones en español, tono técnico y respetuoso, dirigidas al productor.",
  "   - Si se aprueba: menciona el grado y los parámetros que estén cerca del límite del grado siguiente, con una recomendación práctica para mejorar o mantener la calidad.",
  "   - Si se rechaza: explica qué parámetros no cumplen y qué debe corregir el productor (fermentación, secado, limpieza, almacenamiento) antes de solicitar una nueva certificación.",
  "5. Escribe los números con coma decimal (6,8 %)."
].join("\n");


// ----------------------------------------------------------
// Datos del lote para la consulta (solo datos técnicos)
// ----------------------------------------------------------
const construirConsulta = ({ evaluacion, decision, tipoCertificacion, estadoGrano }) => {
  const filas = evaluacion.parametros.map((p) => {
    const def = PARAMETROS.find((x) => x.clave === p.clave);
    const obtenido = p.grado ? `Grado ${p.grado}` : "NO CUMPLE";
    return `- ${p.nombre}: ${numero(p.valor)} ${p.unidad} → ${obtenido} ` +
      `(Grado 1: ${textoLimite(def, 0)}; Grado 2: ${textoLimite(def, 1)}; Grado 3: ${textoLimite(def, 2)})`;
  });

  const generales = evaluacion.generales.map((g) => `- ${g.nombre}: ${g.cumple ? "cumple" : "NO cumple"}`);

  return [
    `Decisión del certificador: ${decision === "rechazar" ? "RECHAZAR" : "APROBAR"}`,
    `Tipo de certificación: ${tipoCertificacion || "no indicado"}`,
    `Estado del grano registrado en el lote: ${estadoGrano || "seco"}`,
    `Resultado según la norma: ${evaluacion.cumple ? `CUMPLE, Grado ${evaluacion.grado}` : "NO CUMPLE"}`,
    ...(evaluacion.motivos.length ? [`Motivos: ${evaluacion.motivos.join("; ")}`] : []),
    "",
    "Análisis de la muestra:",
    ...filas,
    "",
    "Requisitos generales:",
    ...generales
  ].join("\n");
};


// Recorta un texto sin cortar palabras
const recortar = (texto, maximo) => {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo + 1).replace(/\s+\S*$/, "");
  return corte.replace(/[,;:\s]+$/, "");
};


// Lee el JSON de la respuesta del modelo
const leerRespuesta = (cuerpo) => {
  const partes = cuerpo?.candidates?.[0]?.content?.parts || [];
  const texto = partes.filter((p) => !p.thought && p.text).map((p) => p.text).join("").trim();

  if (!texto) {
    const motivo = cuerpo?.promptFeedback?.blockReason || cuerpo?.candidates?.[0]?.finishReason;
    throw new ErrorIA(`La IA no devolvió una propuesta${motivo ? ` (${motivo})` : ""}. Intenta de nuevo.`);
  }

  let datos;
  try {
    datos = JSON.parse(texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new ErrorIA("La IA devolvió una respuesta que no se pudo leer. Intenta de nuevo.");
  }

  const resultado = recortar(datos.resultado, MAX_RESULTADO).replace(/\.$/, "");
  const observaciones = recortar(datos.observaciones, MAX_OBSERVACIONES);

  if (!resultado || !observaciones) {
    throw new ErrorIA("La propuesta de la IA llegó incompleta. Intenta de nuevo.");
  }

  return { resultado, observaciones };
};


// ----------------------------------------------------------
// Pide la propuesta al modelo
// ----------------------------------------------------------
const sugerirDictamen = async (datos) => {
  if (!iaConfigurada()) {
    throw new ErrorIA("El asistente de IA no está configurado (falta GEMINI_API_KEY en el servidor).", 503);
  }

  const modelo = process.env.GEMINI_MODELO || MODELO_POR_DEFECTO;

  let respuesta;
  try {
    respuesta = await cliente.fetch(`${URL_API}/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
        contents: [{ role: "user", parts: [{ text: construirConsulta(datos) }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              resultado: { type: "STRING" },
              observaciones: { type: "STRING" }
            },
            required: ["resultado", "observaciones"]
          }
        }
      }),
      signal: AbortSignal.timeout(ESPERA_MS)
    });
  } catch (error) {
    const tiempo = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new ErrorIA(
      tiempo
        ? "La IA tardó demasiado en responder. Intenta de nuevo."
        : "No se pudo conectar con el servicio de IA. Revisa la conexión a internet.",
      504
    );
  }

  if (!respuesta.ok) {
    let detalle = "";
    try { detalle = (await respuesta.json())?.error?.message || ""; } catch { /* sin cuerpo */ }
    console.error(`Asistente IA: error ${respuesta.status} del servicio: ${detalle}`);

    if (respuesta.status === 429) {
      throw new ErrorIA("Se alcanzó el límite gratuito de consultas a la IA por hoy. Redacta el dictamen a mano o inténtalo más tarde.", 429);
    }
    if (respuesta.status === 400 || respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorIA("El servicio de IA rechazó la clave o el modelo configurado. Avisa al administrador.", 502);
    }
    if (respuesta.status === 404) {
      throw new ErrorIA(`El modelo de IA «${modelo}» no existe o ya no está disponible. Avisa al administrador.`, 502);
    }
    throw new ErrorIA("El servicio de IA no está disponible en este momento. Intenta más tarde.", 502);
  }

  return { ...leerRespuesta(await respuesta.json()), modelo };
};


module.exports = {
  ErrorIA,
  cliente,
  iaConfigurada,
  construirConsulta,
  leerRespuesta,
  recortar,
  sugerirDictamen,
  MODELO_POR_DEFECTO,
  MAX_RESULTADO
};
