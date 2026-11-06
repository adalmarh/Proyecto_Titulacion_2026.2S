import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  LuSprout,
  LuMapPin,
  LuShieldCheck,
  LuShieldAlert,
  LuShieldQuestion,
  LuHourglass,
  LuQrCode,
  LuWifiOff,
  LuRefreshCw,
  LuPaperclip,
  LuCircleAlert,
  LuSignature
} from "react-icons/lu";

import api from "../services/api";
import {
  NOMBRE_ESTADO_LOTE,
  NOMBRE_TIPO_EVENTO,
  formatearFecha
} from "../utils/formatos";
import { NOMBRE_ROL } from "../utils/permisos";
import { iconoEvento } from "../utils/iconos";

import "./ConsultaPublicaQR.css";


// ==========================================================
// CONSULTA PÚBLICA DEL QR (consumidor final)
// ----------------------------------------------------------
// Página que se abre al escanear el código QR del lote.
// No requiere iniciar sesión y solo muestra la información
// pública que entrega el backend (utils/respuestaPublica.js).
// ==========================================================


const nombre = (persona) =>
  persona ? `${persona.nombre} ${persona.apellido}`.trim() : "";

const esEnlace = (texto) => /^https?:\/\//i.test(texto || "");

const lugar = (...partes) => partes.filter(Boolean).join(", ");


// ----------------------------------------------------------
// Sello de origen (elemento principal de la cabecera)
// ----------------------------------------------------------

const SelloOrigen = ({ codigo, verificado }) => (
  <svg
    className="cp-sello"
    viewBox="0 0 200 200"
    role="img"
    aria-label={`Sello de origen del lote ${codigo}`}
  >
    <defs>
      <path
        id="cp-arco"
        d="M 100,100 m -74,0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
      />
    </defs>

    <circle cx="100" cy="100" r="96" className="cp-sello-borde" />
    <circle cx="100" cy="100" r="58" className="cp-sello-centro" />

    {/* textLength reparte el texto exactamente en la circunferencia (2·π·74 ≈ 465) */}
    <text className="cp-sello-arco">
      <textPath
        href="#cp-arco"
        startOffset="0"
        textLength="458"
        lengthAdjust="spacing"
      >
        Cacao fino de aroma · Origen Ecuador · Trazable ·
      </textPath>
    </text>

    {/* mazorca de cacao */}
    <g className="cp-sello-mazorca" transform="translate(100 86) rotate(-28)">
      <ellipse cx="0" cy="0" rx="13" ry="24" />
      <path d="M0 -24 V24 M-7 -21 Q-11 0 -7 21 M7 -21 Q11 0 7 21" />
    </g>

    <text x="100" y="128" textAnchor="middle" className="cp-sello-codigo">
      {codigo}
    </text>

    {verificado && (
      <g transform="translate(100 154)">
        <circle r="15" className="cp-sello-check-fondo" />
        <path d="M-6 0 l4 4.5 l8.5 -9" className="cp-sello-check" />
      </g>
    )}
  </svg>
);


// ----------------------------------------------------------
// Estado de la certificación (debajo del título)
// ----------------------------------------------------------

const EstadoCertificacion = ({ certificacion }) => {
  const { estado, vigente } = certificacion;

  if (estado === "vigente") {
    return (
      <p className="cp-estado cp-estado-vigente">
        <LuShieldCheck aria-hidden="true" />
        <span>
          Certificación {vigente.tipoCertificacion.toLowerCase()} vigente
          {vigente.fechaVencimiento &&
            ` hasta el ${formatearFecha(vigente.fechaVencimiento)}`}
        </span>
      </p>
    );
  }

  if (estado === "vencida") {
    return (
      <p className="cp-estado cp-estado-vencida">
        <LuShieldAlert aria-hidden="true" />
        <span>La certificación de este lote está vencida</span>
      </p>
    );
  }

  if (estado === "en_tramite") {
    return (
      <p className="cp-estado">
        <LuHourglass aria-hidden="true" />
        <span>Certificación en trámite</span>
      </p>
    );
  }

  return (
    <p className="cp-estado">
      <LuShieldQuestion aria-hidden="true" />
      <span>Sin certificación registrada</span>
    </p>
  );
};


// ----------------------------------------------------------
// Pantallas de carga y error
// ----------------------------------------------------------

const Marca = () => (
  <div className="cp-marca">
    <LuSprout aria-hidden="true" />
    RutaCacao
  </div>
);

const PantallaCarga = () => (
  <div className="cp cp-pantalla">
    <Marca />
    <div className="cp-cargando" role="status">
      <span className="cp-giro" aria-hidden="true" />
      <p>Consultando el origen del lote…</p>
    </div>
  </div>
);

const PantallaError = ({ tipo, reintentar }) => (
  <div className="cp cp-pantalla">
    <Marca />
    <div className="cp-error">
      {tipo === "qr" ? (
        <>
          <LuQrCode className="cp-error-icono" aria-hidden="true" />
          <h1>Este código QR no está activo</h1>
          <p>
            Puede que la empresa lo haya reemplazado por uno nuevo.
            Escanea el código impreso más reciente o consulta al vendedor.
          </p>
        </>
      ) : (
        <>
          <LuWifiOff className="cp-error-icono" aria-hidden="true" />
          <h1>No se pudo cargar la información</h1>
          <p>
            Comprueba tu conexión a internet y vuelve a intentarlo.
          </p>
          <button className="cp-boton" onClick={reintentar}>
            <LuRefreshCw aria-hidden="true" />
            Volver a intentar
          </button>
        </>
      )}
    </div>
  </div>
);


// ==========================================================
// COMPONENTE PRINCIPAL
// ==========================================================

const ConsultaPublicaQR = () => {

  const { token } = useParams();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const consultar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const respuesta = await api.get(`/public/qr/${token}`);
      setDatos(respuesta.data);

    } catch (err) {
      // 404: QR inexistente, regenerado o desactivado
      setError(err.response?.status === 404 ? "qr" : "conexion");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    consultar();
  }, [consultar]);


  if (cargando) {
    return <PantallaCarga />;
  }

  if (error || !datos) {
    return <PantallaError tipo={error} reintentar={consultar} />;
  }


  const { lote, productor, empresa, trazabilidad, certificacion, certificaciones, qr } = datos;

  const origen = lugar(
    lote.ubicacion?.canton,
    lote.ubicacion?.provincia
  );

  const cosecha = lote.fechaCosecha
    ? { etiqueta: "Cosecha", fecha: lote.fechaCosecha }
    : { etiqueta: "Cosecha estimada", fecha: lote.fechaEstimadaCosecha };

  const eventos = trazabilidad?.eventos || [];
  const vencidas = certificaciones.filter((c) => !c.vigente);


  return (
    <div className="cp">

      {/* ================= CABECERA ================= */}
      <header className="cp-cabecera">
        <div className="cp-ancho">
          <Marca />

          <div className="cp-portada">
            <SelloOrigen
              codigo={lote.codigo}
              verificado={certificacion.estado === "vigente"}
            />

            <div className="cp-portada-texto">
              <h1>{lote.producto}</h1>

              {origen && (
                <p className="cp-origen">
                  <LuMapPin aria-hidden="true" />
                  {origen}
                </p>
              )}

              {empresa?.nombre && (
                <p className="cp-productor-linea">
                  Producido por {nombre(productor) || "productores"} de{" "}
                  {empresa.nombre}
                </p>
              )}

              <EstadoCertificacion certificacion={certificacion} />
            </div>
          </div>
        </div>
      </header>


      <main className="cp-ancho cp-contenido">

        {/* ============== DATOS DEL LOTE ============== */}
        <section aria-labelledby="cp-t-lote">
          <h2 id="cp-t-lote" className="cp-oculto">Datos del lote</h2>

          <dl className="cp-datos">
            <div>
              <dt>Lote</dt>
              <dd className="cp-dato-codigo">{lote.codigo}</dd>
            </div>
            <div>
              <dt>Cantidad</dt>
              <dd>
                {Number(lote.cantidad).toLocaleString("es-EC")} {lote.unidad}
              </dd>
            </div>
            <div>
              <dt>{cosecha.etiqueta}</dt>
              <dd>{formatearFecha(cosecha.fecha)}</dd>
            </div>
            <div>
              <dt>Etapa actual</dt>
              <dd>{NOMBRE_ESTADO_LOTE[lote.estado] || lote.estado}</dd>
            </div>
          </dl>

          {lote.descripcion && (
            <p className="cp-descripcion">{lote.descripcion}</p>
          )}
        </section>


        {!lote.activo && (
          <p className="cp-aviso">
            <LuCircleAlert aria-hidden="true" />
            Este lote ya no está activo en el sistema. La información se
            conserva como registro histórico.
          </p>
        )}


        <div className="cp-columnas">

          {/* ============== RECORRIDO ============== */}
          <section className="cp-seccion" aria-labelledby="cp-t-recorrido">
            <h2 id="cp-t-recorrido">Recorrido del lote</h2>
            <p className="cp-intro">
              Actividades registradas desde la finca, en orden de fecha.
            </p>

            {eventos.length === 0 ? (
              <p className="cp-vacio">
                Todavía no hay actividades registradas para este lote.
              </p>
            ) : (
              <ol className="cp-recorrido">
                {eventos.map((evento, indice) => {
                  const Icono = iconoEvento(evento.tipo);

                  return (
                    <li key={`${evento.tipo}-${evento.fecha}-${indice}`}>
                      <span className="cp-recorrido-icono" aria-hidden="true">
                        <Icono />
                      </span>

                      <div className="cp-recorrido-texto">
                        <div className="cp-recorrido-cabecera">
                          <h3>{NOMBRE_TIPO_EVENTO[evento.tipo] || evento.tipo}</h3>
                          <time dateTime={evento.fecha}>
                            {formatearFecha(evento.fecha)}
                          </time>
                        </div>

                        <p>{evento.descripcion}</p>

                        {evento.responsable && (
                          <p className="cp-recorrido-meta">
                            {evento.responsable && (
                              <span>
                                Registró: {nombre(evento.responsable)}
                                {evento.responsable.rol &&
                                  ` (${(NOMBRE_ROL[evento.responsable.rol] || evento.responsable.rol).toLowerCase()})`}
                              </span>
                            )}
                          </p>
                        )}

                        {evento.evidencia && (
                          <p className="cp-recorrido-meta">
                            <LuPaperclip aria-hidden="true" />
                            {esEnlace(evento.evidencia) ? (
                              <a href={evento.evidencia} target="_blank" rel="noreferrer">
                                Ver evidencia
                              </a>
                            ) : (
                              <span>{evento.evidencia}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>


          <div className="cp-lateral">

            {/* ============== PRODUCTOR ============== */}
            <section className="cp-seccion" aria-labelledby="cp-t-origen">
              <h2 id="cp-t-origen">Quién lo produjo</h2>

              {productor && (
                <p className="cp-persona">{nombre(productor)}</p>
              )}

              {empresa?.nombre && (
                <p className="cp-detalle">
                  Productor de {empresa.nombre}
                  {empresa.ciudad && `, ${empresa.ciudad}`}
                </p>
              )}

              {(lote.ubicacion?.parroquia || lote.ubicacion?.descripcion) && (
                <p className="cp-detalle">
                  <LuMapPin aria-hidden="true" />
                  {lugar(lote.ubicacion.parroquia, lote.ubicacion.descripcion)}
                </p>
              )}

              {lote.fechaSiembra && (
                <p className="cp-detalle">
                  Sembrado el {formatearFecha(lote.fechaSiembra)}
                </p>
              )}
            </section>


            {/* ============== CERTIFICACIÓN ============== */}
            <section
              className={`cp-seccion cp-certificacion cp-certificacion-${certificacion.estado}`}
              aria-labelledby="cp-t-cert"
            >
              <h2 id="cp-t-cert">Certificación</h2>

              {certificacion.estado === "vigente" ? (
                <>
                  <p className="cp-cert-tipo">
                    <LuShieldCheck aria-hidden="true" />
                    {certificacion.vigente.tipoCertificacion}
                  </p>

                  <dl className="cp-cert-datos">
                    {certificacion.vigente.codigo && (
                      <div>
                        <dt>Código</dt>
                        <dd>{certificacion.vigente.codigo}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Aprobada</dt>
                      <dd>{formatearFecha(certificacion.vigente.fechaEmision)}</dd>
                    </div>
                    <div>
                      <dt>Válida hasta</dt>
                      <dd>
                        {certificacion.vigente.fechaVencimiento
                          ? formatearFecha(certificacion.vigente.fechaVencimiento)
                          : "Sin fecha de vencimiento"}
                      </dd>
                    </div>
                    {certificacion.vigente.certificador && (
                      <div>
                        <dt>Evaluó</dt>
                        <dd>{nombre(certificacion.vigente.certificador)}</dd>
                      </div>
                    )}
                  </dl>

                  {certificacion.vigente.observaciones && (
                    <p className="cp-detalle">{certificacion.vigente.observaciones}</p>
                  )}

                  {certificacion.vigente.firmada && (
                    <p className="cp-firma">
                      <LuSignature aria-hidden="true" />
                      <span>
                        {certificacion.vigente.tipoFirma === "manuscrita"
                          ? "Certificado firmado"
                          : "Certificado firmado electrónicamente"}
                        {certificacion.vigente.firmante && ` por ${certificacion.vigente.firmante}`}.
                      </span>
                    </p>
                  )}

                  {certificacion.vigente.codigoVerificacion && (
                    <Link
                      className="cp-verificar"
                      to={`/verificar/${certificacion.vigente.codigoVerificacion}`}
                    >
                      Verificar el certificado
                    </Link>
                  )}
                </>
              ) : (
                <p className="cp-detalle">
                  {certificacion.estado === "vencida" &&
                    "El lote tuvo una certificación aprobada, pero su vigencia ya terminó."}
                  {certificacion.estado === "en_tramite" &&
                    "Se solicitó una certificación y un certificador la está evaluando."}
                  {certificacion.estado === "sin_certificacion" &&
                    "Este lote todavía no cuenta con una certificación aprobada en el sistema."}
                </p>
              )}

              {vencidas.length > 0 && (
                <ul className="cp-cert-historial">
                  {vencidas.map((c) => (
                    <li key={c.codigo || c.fechaEmision}>
                      {c.tipoCertificacion}, vencida el {formatearFecha(c.fechaVencimiento)}
                    </li>
                  ))}
                </ul>
              )}

              <p className="cp-nota">
                La certificación es aprobada por un certificador registrado
                en el sistema.
              </p>
            </section>

          </div>
        </div>
      </main>


      {/* ================= PIE ================= */}
      <footer className="cp-pie">
        <div className="cp-ancho">
          <p>
            Información registrada por {empresa?.nombre || "la empresa"} y sus productores en
            RutaCacao, sistema de trazabilidad de cacao fino de aroma.
          </p>
          <p>
            Este código se ha consultado{" "}
            {qr.totalEscaneos === 1 ? "1 vez" : `${qr.totalEscaneos} veces`}.
          </p>
          <p>
            <Link to="/privacidad" className="cp-enlace-pie">Aviso de privacidad</Link>
          </p>
        </div>
      </footer>

    </div>
  );
};

export default ConsultaPublicaQR;
