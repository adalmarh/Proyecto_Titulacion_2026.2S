import { useCallback, useEffect, useState } from "react";

import {
  LuExternalLink,
  LuDownload,
  LuRefreshCw,
  LuPower,
  LuQrCode,
  LuTriangleAlert,
  LuCircleCheck
} from "react-icons/lu";

import Modal from "./Modal";
import api from "../services/api";
import { usePermisos } from "../utils/permisos";
import { formatearFechaHora } from "../utils/formatos";


// ==========================================================
// CÓDIGO QR DE UN LOTE
// Muestra el QR activo del lote y permite abrir la consulta
// pública, descargar la imagen, regenerarlo o desactivarlo.
// Si el lote aún no tiene QR, ofrece generarlo.
// Lo usan las páginas Lotes y Códigos QR.
// ==========================================================

const ModalQR = ({ lote, onCerrar, onCambio }) => {

  const permisos = usePermisos();

  const [datos, setDatos] = useState(null);     // { qr, imagen }
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");


  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const respuesta = await api.get(`/qr/lote/${lote._id}`);
      setDatos(respuesta.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setDatos(null);
      } else {
        setError(err.response?.data?.mensaje || "No se pudo cargar el código QR");
      }
    } finally {
      setCargando(false);
    }
  }, [lote._id]);

  useEffect(() => {
    cargar();
  }, [cargar]);


  const ejecutar = async (accion, confirmacion, exito) => {
    if (confirmacion && !window.confirm(confirmacion)) {
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const respuesta = await accion();
      setMensaje(respuesta.data?.mensaje || exito);
      onCambio?.();
      return respuesta;

    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo completar la acción");
    } finally {
      setProcesando(false);
    }
  };

  const generar = async () => {
    const respuesta = await ejecutar(
      () => api.post(`/qr/lote/${lote._id}`),
      null,
      "Código QR generado correctamente"
    );
    if (respuesta) setDatos(respuesta.data);
  };

  const regenerar = async () => {
    const respuesta = await ejecutar(
      () => api.patch(`/qr/lote/${lote._id}/regenerar`),
      "Se creará un código nuevo y el anterior dejará de funcionar. Los QR ya impresos tendrán que reemplazarse. ¿Continuar?",
      "Código QR regenerado correctamente"
    );
    if (respuesta) setDatos(respuesta.data);
  };

  const desactivar = async () => {
    const respuesta = await ejecutar(
      () => api.patch(`/qr/lote/${lote._id}/desactivar`),
      "El código dejará de mostrar la información del lote al escanearlo. ¿Desactivarlo?",
      "Código QR desactivado"
    );
    if (respuesta) setDatos(null);
  };

  const descargar = () => {
    if (!datos?.imagen) return;
    const enlace = document.createElement("a");
    enlace.href = datos.imagen;
    enlace.download = `QR-${lote.codigo}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  };


  const qr = datos?.qr;

  return (
    <Modal
      titulo="Código QR del lote"
      subtitulo={`${lote.codigo} · ${lote.producto || "Cacao fino de aroma"}`}
      onCerrar={onCerrar}
      bloqueado={procesando}
      ancho
    >
      {cargando ? (
        <div className="gs-vacio">Cargando código QR...</div>
      ) : !qr ? (

        /* ---------- Lote sin QR activo ---------- */
        <div className="gs-vacio">
          <LuQrCode aria-hidden="true" />
          <h3>Este lote no tiene un código QR activo</h3>
          <p>
            Al generarlo, cualquier persona podrá escanearlo y ver el origen
            y la trazabilidad del lote.
          </p>

          {error && (
            <div className="gs-alerta gs-alerta-error" style={{ marginTop: 16, textAlign: "left" }}>
              <LuTriangleAlert aria-hidden="true" />
              {error}
            </div>
          )}

          {permisos.generarQR && (
            <button
              className="gs-btn gs-btn-principal"
              style={{ marginTop: 18 }}
              onClick={generar}
              disabled={procesando}
            >
              <LuQrCode aria-hidden="true" />
              {procesando ? "Generando..." : "Generar código QR"}
            </button>
          )}
        </div>

      ) : (

        /* ---------- QR activo ---------- */
        <div className="gs-qr">
          <div>
            <div className="gs-qr-imagen">
              {datos.imagen ? (
                <img src={datos.imagen} alt={`Código QR del lote ${lote.codigo}`} />
              ) : (
                <span className="gs-ayuda">Imagen no disponible</span>
              )}
            </div>
          </div>

          <div>
            {mensaje && (
              <div className="gs-alerta gs-alerta-exito">
                <LuCircleCheck aria-hidden="true" />
                {mensaje}
              </div>
            )}

            {error && (
              <div className="gs-alerta gs-alerta-error">
                <LuTriangleAlert aria-hidden="true" />
                {error}
              </div>
            )}

            <dl className="gs-ficha">
              <dt>Estado</dt>
              <dd><span className="gs-etiqueta gs-activo">Activo</span></dd>
              <dt>Escaneos</dt>
              <dd>{qr.totalEscaneos || 0}</dd>
              <dt>Último escaneo</dt>
              <dd>{qr.ultimoEscaneo ? formatearFechaHora(qr.ultimoEscaneo) : "Aún no se ha escaneado"}</dd>
              <dt>Enlace</dt>
              <dd>
                <a className="gs-enlace" href={qr.urlPublica} target="_blank" rel="noreferrer">
                  {qr.urlPublica}
                </a>
              </dd>
            </dl>

            <div className="gs-qr-acciones">
              <a
                className="gs-btn gs-btn-principal"
                href={qr.urlPublica}
                target="_blank"
                rel="noreferrer"
              >
                <LuExternalLink aria-hidden="true" />
                Abrir consulta pública
              </a>

              <button className="gs-btn gs-btn-secundario" onClick={descargar}>
                <LuDownload aria-hidden="true" />
                Descargar imagen
              </button>

              {permisos.administrarQR && (
                <>
                  <button
                    className="gs-btn gs-btn-secundario"
                    onClick={regenerar}
                    disabled={procesando}
                  >
                    <LuRefreshCw aria-hidden="true" />
                    Regenerar código
                  </button>

                  <button
                    className="gs-btn gs-btn-peligro"
                    onClick={desactivar}
                    disabled={procesando}
                  >
                    <LuPower aria-hidden="true" />
                    Desactivar código
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ModalQR;
