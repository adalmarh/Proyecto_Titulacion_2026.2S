import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  LuSprout,
  LuShieldCheck,
  LuShieldAlert,
  LuShieldX,
  LuSignature,
  LuFileSearch,
  LuCircleCheck,
  LuCircleX,
  LuTriangleAlert
} from "react-icons/lu";

import api from "../services/api";
import { formatearCantidad, formatearFecha, formatearFechaHora } from "../utils/formatos";
import { huellaSHA256 } from "../utils/sha256";

import "./VerificarCertificado.css";


// ==========================================================
// VERIFICACIÓN PÚBLICA DE UN CERTIFICADO
// Se abre al escanear el QR impreso en el certificado PDF.
// Muestra si el certificado existe, si está vigente y si el
// certificador lo firmó (a mano o electrónicamente), y permite
// comprobar que una copia del PDF es idéntica a la firmada
// (huella SHA-256), sin subir el archivo a ningún servidor.
// ==========================================================

const nombre = (p) => (p ? `${p.nombre || ""} ${p.apellido || ""}`.trim() : "—");


const VerificarCertificado = () => {

  const { codigo } = useParams();

  const [datos, setDatos] = useState(null);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | no_existe | error
  const [comparacion, setComparacion] = useState(null); // null | "calculando" | "igual" | "distinto"
  const [archivoNombre, setArchivoNombre] = useState("");

  useEffect(() => {
    api.get(`/public/certificados/${encodeURIComponent(codigo)}`)
      .then((r) => { setDatos(r.data); setEstado("listo"); })
      .catch((err) => setEstado(err.response?.status === 404 ? "no_existe" : "error"));
  }, [codigo]);

  const comparar = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setArchivoNombre(archivo.name);
    setComparacion("calculando");
    const huella = await huellaSHA256(archivo);
    setComparacion(huella === datos.firma.sha256 ? "igual" : "distinto");
  };


  const vigente = datos?.estado === "vigente";
  const firma = datos?.firma;
  const electronica = firma?.firmada && firma.tipo !== "manuscrita";

  return (
    <div className="vf">

      <header className="vf-cabecera">
        <div className="vf-ancho">
          <span className="vf-marca">
            <LuSprout aria-hidden="true" />
            RutaCacao
          </span>
          <span className="vf-titulo-cabecera">Verificación de certificados</span>
        </div>
      </header>

      <main className="vf-ancho vf-contenido">

        {estado === "cargando" && <p className="vf-cargando">Verificando el certificado…</p>}

        {estado === "no_existe" && (
          <section className="vf-resultado vf-invalido">
            <LuShieldX aria-hidden="true" />
            <div>
              <h1>Certificado no encontrado</h1>
              <p>
                Este código no corresponde a ningún certificado emitido por RutaCacao.
                Si alguien le entregó este documento como válido, desconfíe de él.
              </p>
            </div>
          </section>
        )}

        {estado === "error" && (
          <section className="vf-resultado vf-aviso">
            <LuTriangleAlert aria-hidden="true" />
            <div>
              <h1>No se pudo verificar</h1>
              <p>No hay conexión con el sistema en este momento. Inténtelo de nuevo en unos minutos.</p>
            </div>
          </section>
        )}

        {estado === "listo" && datos && (
          <>
            <section className={`vf-resultado ${vigente ? "vf-valido" : "vf-aviso"}`}>
              {vigente ? <LuShieldCheck aria-hidden="true" /> : <LuShieldAlert aria-hidden="true" />}
              <div>
                <h1>{vigente ? "Certificado válido y vigente" : "Certificado vencido"}</h1>
                <p>
                  {datos.tipoCertificacion} · {datos.codigo}
                  {datos.fechaVencimiento &&
                    (vigente
                      ? ` · válido hasta el ${formatearFecha(datos.fechaVencimiento)}`
                      : ` · venció el ${formatearFecha(datos.fechaVencimiento)}`)}
                </p>
              </div>
            </section>

            <section className="vf-tarjeta">
              <h2>Datos del certificado</h2>
              <dl className="vf-datos">
                <dt>Lote</dt>
                <dd>{datos.lote?.codigo}</dd>
                <dt>Producto</dt>
                <dd>{datos.lote?.producto}</dd>
                <dt>Cantidad</dt>
                <dd>{formatearCantidad(datos.lote?.cantidad, datos.lote?.estadoGrano, { grano: true })}</dd>
                <dt>Origen</dt>
                <dd>{[datos.lote?.canton, datos.lote?.provincia].filter(Boolean).join(", ") || "—"}</dd>
                <dt>Productor</dt>
                <dd>{nombre(datos.productor)}</dd>
                <dt>Empresa</dt>
                <dd>{datos.empresa?.nombre || "—"}</dd>
                <dt>Emitido</dt>
                <dd>{formatearFecha(datos.fechaEmision)}</dd>
                <dt>Certificador</dt>
                <dd>{nombre(datos.certificador)}</dd>
              </dl>
            </section>

            <section className="vf-tarjeta">
              <h2>
                <LuSignature aria-hidden="true" />
                Firma del certificador
              </h2>

              {firma?.firmada ? (
                <>
                  <p className="vf-firma-ok">
                    <LuCircleCheck aria-hidden="true" />
                    <span>
                      {electronica ? "Firmado electrónicamente por " : "Firmado por el certificador "}
                      <strong>{firma.firmante}</strong>
                      {firma.fechaFirma && ` el ${formatearFechaHora(firma.fechaFirma)}`}
                    </span>
                  </p>
                  {!electronica && (
                    <p className="vf-nota">
                      Firma manuscrita: el certificador subió al sistema el certificado firmado y escaneado.
                    </p>
                  )}
                  {electronica && firma.emisor && (
                    <p className="vf-nota">Certificado de firma emitido por: {firma.emisor}</p>
                  )}
                  {electronica && firma.autofirmado && (
                    <p className="vf-nota vf-nota-aviso">
                      La firma se hizo con un certificado de prueba, no emitido por una entidad de certificación acreditada.
                    </p>
                  )}

                  <div className="vf-comparar">
                    <h3>
                      <LuFileSearch aria-hidden="true" />
                      ¿Tiene una copia del PDF? Compruebe que sea la original
                    </h3>
                    <p className="vf-explica">
                      El archivo se revisa en su propio dispositivo; no se envía a ningún servidor.
                    </p>
                    <label className="vf-archivo">
                      <input type="file" accept="application/pdf,.pdf" onChange={comparar} />
                      {archivoNombre || "Elegir el archivo PDF…"}
                    </label>

                    {comparacion === "calculando" && <p className="vf-nota">Comparando…</p>}
                    {comparacion === "igual" && (
                      <p className="vf-coincide">
                        <LuCircleCheck aria-hidden="true" />
                        Este archivo es idéntico al certificado firmado registrado en RutaCacao.
                      </p>
                    )}
                    {comparacion === "distinto" && (
                      <p className="vf-no-coincide">
                        <LuCircleX aria-hidden="true" />
                        Este archivo no es idéntico al certificado firmado: puede ser otra versión o haber sido modificado.
                      </p>
                    )}
                  </div>

                  {electronica && (
                    <p className="vf-nota">
                      También puede abrir el PDF en FirmaEC o en Adobe Acrobat Reader para ver la firma y comprobar que el documento no fue alterado.
                    </p>
                  )}
                </>
              ) : (
                <p className="vf-nota">
                  Este certificado todavía no tiene la firma del certificador registrada en el sistema.
                </p>
              )}
            </section>
          </>
        )}

        <p className="vf-pie">
          <Link to="/privacidad">Aviso de privacidad</Link>
        </p>
      </main>
    </div>
  );
};

export default VerificarCertificado;
