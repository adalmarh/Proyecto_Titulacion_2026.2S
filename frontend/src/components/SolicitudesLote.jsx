import { useCallback, useEffect, useState } from "react";

import {
  LuSend,
  LuInbox,
  LuPackagePlus,
  LuCircleX,
  LuTriangleAlert,
  LuClock,
  LuCircleCheck,
  LuBan
} from "react-icons/lu";

import api from "../services/api";
import Modal from "./Modal";
import {
  UNIDADES_ENTRADA,
  ESTADOS_GRANO,
  KG_POR_QUINTAL,
  numeroEC,
  formatearCantidad,
  formatearFecha,
  formatearFechaHora,
  nombreCompleto
} from "../utils/formatos";


// ==========================================================
// SOLICITUDES DE LOTE
//  - ModalSolicitudLote: el productor pide un lote nuevo.
//  - PanelSolicitudesLote:
//      · productor: sus solicitudes y su estado;
//      · administrador: las pendientes, con «Crear lote»
//        (abre el formulario de Nuevo lote ya lleno) y
//        «Rechazar» (con motivo).
// ==========================================================

const fechaCampo = (valor) => (valor ? String(valor).substring(0, 10) : "");
const hoyCampo = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const ESTADO = {
  pendiente: { texto: "Pendiente", icono: LuClock },
  aprobada: { texto: "Aprobada", icono: LuCircleCheck },
  rechazada: { texto: "Rechazada", icono: LuCircleX },
  cancelada: { texto: "Cancelada", icono: LuBan }
};


// ----------------------------------------------------------
// Formulario del productor
// ----------------------------------------------------------
export const ModalSolicitudLote = ({ onCerrar, onEnviada }) => {

  const [formulario, setFormulario] = useState({
    cantidad: "",
    unidad: "quintales",
    estadoGrano: "seco",
    fechaSiembra: "",
    fechaEstimadaCosecha: "",
    mensaje: ""
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [desdeFicha, setDesdeFicha] = useState(false);

  // Se llena con la producción estimada de su ficha, si la tiene
  useEffect(() => {
    api.get("/productores")
      .then((r) => {
        const lista = Array.isArray(r.data) ? r.data : r.data?.productores || [];
        const prod = lista[0]?.produccion;
        if (!prod) return;
        setFormulario((f) => ({
          ...f,
          cantidad: f.cantidad || (prod.cantidadEstimadaKg ? String(Math.round((prod.cantidadEstimadaKg / KG_POR_QUINTAL) * 100) / 100) : ""),
          estadoGrano: prod.estadoGrano || f.estadoGrano,
          fechaSiembra: f.fechaSiembra || fechaCampo(prod.fechaSiembra),
          fechaEstimadaCosecha: f.fechaEstimadaCosecha || fechaCampo(prod.fechaEstimadaCosecha)
        }));
        if (prod.cantidadEstimadaKg || prod.fechaSiembra) setDesdeFicha(true);
      })
      .catch(() => {});
  }, []);

  const cambiar = (e) => setFormulario((f) => ({ ...f, [e.target.name]: e.target.value }));

  const numero = Number(String(formulario.cantidad).replace(",", "."));
  const equivalencia = numero > 0
    ? (formulario.unidad === "quintales"
      ? `Equivale a ${numeroEC(numero * KG_POR_QUINTAL)} kg`
      : `Equivale a ≈ ${numeroEC(numero / KG_POR_QUINTAL, 1)} quintales`)
    : "";

  const enviar = async (e) => {
    e.preventDefault();
    setError("");

    if (!(numero > 0)) {
      setError("Indica la cantidad aproximada de cacao del lote.");
      return;
    }

    try {
      setEnviando(true);
      await api.post("/solicitudes-lote", formulario);
      onEnviada("Solicitud enviada. El administrador la revisará y registrará tu lote.");
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Solicitar un nuevo lote"
      subtitulo="El administrador revisa la solicitud y registra el lote con su código."
      onCerrar={onCerrar}
      bloqueado={enviando}
    >
      <form className="gs-formulario" onSubmit={enviar}>
        {error && (
          <div className="gs-alerta gs-alerta-error" role="alert">
            <LuTriangleAlert aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="gs-campos">
          {desdeFicha && (
            <p className="gs-campo-ancho lt-autollenado">
              Datos tomados de tu producción estimada. Cámbialos si este lote es distinto.
            </p>
          )}

          <div className="gs-campo">
            <label htmlFor="sl-cantidad">Cantidad aproximada *</label>
            <input id="sl-cantidad" name="cantidad" type="number" min="0.01" step="any" inputMode="decimal" value={formulario.cantidad} onChange={cambiar} required />
            {equivalencia && <span className="gs-ayuda">{equivalencia}</span>}
          </div>

          <div className="gs-campo">
            <label htmlFor="sl-unidad">Unidad</label>
            <select id="sl-unidad" name="unidad" value={formulario.unidad} onChange={cambiar}>
              {UNIDADES_ENTRADA.map((u) => <option key={u.valor} value={u.valor}>{u.texto}</option>)}
            </select>
          </div>

          <div className="gs-campo">
            <label htmlFor="sl-grano">Estado del grano</label>
            <select id="sl-grano" name="estadoGrano" value={formulario.estadoGrano} onChange={cambiar}>
              {Object.entries(ESTADOS_GRANO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
            </select>
          </div>

          <div className="gs-campo">
            <label htmlFor="sl-siembra">Fecha de siembra</label>
            <input id="sl-siembra" name="fechaSiembra" type="date" min="1950-01-01" max={hoyCampo()} value={formulario.fechaSiembra} onChange={cambiar} />
          </div>

          <div className="gs-campo">
            <label htmlFor="sl-cosecha">Cosecha estimada</label>
            <input id="sl-cosecha" name="fechaEstimadaCosecha" type="date" min={formulario.fechaSiembra || undefined} value={formulario.fechaEstimadaCosecha} onChange={cambiar} />
          </div>

          <div className="gs-campo gs-campo-ancho">
            <label htmlFor="sl-mensaje">Mensaje para el administrador (opcional)</label>
            <textarea id="sl-mensaje" name="mensaje" rows={3} maxLength={500} value={formulario.mensaje} onChange={cambiar} placeholder="Ej.: Cacao de la parcela junto al río, listo para entregar la próxima semana" />
          </div>
        </div>

        <div className="gs-botones-modal">
          <button type="button" className="gs-btn gs-btn-secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="gs-btn gs-btn-principal" disabled={enviando}>
            <LuSend aria-hidden="true" />
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </form>
    </Modal>
  );
};


// ----------------------------------------------------------
// Ventana para rechazar (administrador)
// ----------------------------------------------------------
const ModalRechazo = ({ solicitud, onCerrar, onListo }) => {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const rechazar = async (e) => {
    e.preventDefault();
    try {
      setEnviando(true);
      setError("");
      await api.patch(`/solicitudes-lote/${solicitud._id}/rechazar`, { motivo });
      onListo(`Solicitud de ${nombreCompleto(solicitud.productor)} rechazada`);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo rechazar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Rechazar solicitud de lote" subtitulo={nombreCompleto(solicitud.productor)} onCerrar={onCerrar} bloqueado={enviando}>
      <form className="gs-formulario" onSubmit={rechazar}>
        {error && (
          <div className="gs-alerta gs-alerta-error" role="alert">
            <LuTriangleAlert aria-hidden="true" />
            {error}
          </div>
        )}
        <div className="gs-campo">
          <label htmlFor="sl-motivo">Motivo (lo verá el productor) *</label>
          <textarea id="sl-motivo" rows={3} minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: La cantidad no coincide con la entrega; vuelve a solicitarlo con el peso real" required />
        </div>
        <div className="gs-botones-modal">
          <button type="button" className="gs-btn gs-btn-secundario" onClick={onCerrar} disabled={enviando}>Cancelar</button>
          <button type="submit" className="gs-btn gs-btn-rechazo" disabled={enviando || motivo.trim().length < 5}>
            <LuCircleX aria-hidden="true" />
            {enviando ? "Rechazando..." : "Rechazar"}
          </button>
        </div>
      </form>
    </Modal>
  );
};


// ----------------------------------------------------------
// Panel de solicitudes (productor o administrador)
// ----------------------------------------------------------
export const PanelSolicitudesLote = ({ esAdmin, recargar = 0, onCrearLote, onMensaje }) => {

  const [solicitudes, setSolicitudes] = useState([]);
  const [rechazando, setRechazando] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await api.get("/solicitudes-lote", { params: esAdmin ? { estado: "pendiente" } : {} });
      setSolicitudes(r.data?.solicitudes || []);
    } catch {
      setError("No se pudieron cargar las solicitudes de lote");
    }
  }, [esAdmin]);

  useEffect(() => { cargar(); }, [cargar, recargar]);

  const cancelar = async (s) => {
    try {
      await api.patch(`/solicitudes-lote/${s._id}/cancelar`);
      onMensaje("Solicitud cancelada");
      cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo cancelar la solicitud");
    }
  };

  // El productor ve sus últimas 10; el administrador, las pendientes
  const visibles = esAdmin ? solicitudes : solicitudes.slice(0, 10);

  if (visibles.length === 0 && !error) return null;

  return (
    <section className="gs-panel sl" aria-labelledby="sl-titulo">
      <div className="gs-panel-cabecera">
        <div>
          <h2 id="sl-titulo">
            <LuInbox aria-hidden="true" />
            {esAdmin ? `Solicitudes de lotes pendientes (${visibles.length})` : "Mis solicitudes de lote"}
          </h2>
          <p>
            {esAdmin
              ? "Los productores piden registrar un lote nuevo. Revisa los datos y crea el lote, o rechaza la solicitud."
              : "Cuando el administrador apruebe una solicitud, el lote aparecerá en tu lista."}
          </p>
        </div>
      </div>

      <div className="gs-panel-cuerpo">
        {error && <p className="ia-error" role="alert">{error}</p>}

        <ul className="sl-lista">
          {visibles.map((s) => {
            const E = ESTADO[s.estado] || ESTADO.pendiente;
            return (
              <li key={s._id} className="sl-item">
                <div className="sl-datos">
                  <div className="sl-fila">
                    {esAdmin && <strong>{nombreCompleto(s.productor)}</strong>}
                    <span className={`sl-estado sl-${s.estado}`}>
                      <E.icono aria-hidden="true" />
                      {E.texto}
                    </span>
                    <span className="sl-fecha">Enviada el {formatearFechaHora(s.createdAt)}</span>
                  </div>
                  <p>
                    {formatearCantidad(s.cantidadKg, s.estadoGrano, { grano: true })}
                    {s.fechaSiembra && ` · siembra ${formatearFecha(s.fechaSiembra)}`}
                    {s.fechaEstimadaCosecha && ` · cosecha estimada ${formatearFecha(s.fechaEstimadaCosecha)}`}
                  </p>
                  {s.mensaje && <p className="sl-mensaje">«{s.mensaje}»</p>}
                  {s.estado === "aprobada" && s.lote?.codigo && (
                    <p className="sl-resultado">Lote registrado: <strong>{s.lote.codigo}</strong></p>
                  )}
                  {s.estado === "rechazada" && (
                    <p className="sl-resultado sl-resultado-mal">Motivo: {s.motivoRechazo}</p>
                  )}
                </div>

                <div className="sl-acciones">
                  {esAdmin && s.estado === "pendiente" && (
                    <>
                      <button type="button" className="gs-btn gs-btn-principal" onClick={() => onCrearLote(s)}>
                        <LuPackagePlus aria-hidden="true" />
                        Crear lote
                      </button>
                      <button type="button" className="gs-btn gs-btn-secundario" onClick={() => setRechazando(s)}>
                        <LuCircleX aria-hidden="true" />
                        Rechazar
                      </button>
                    </>
                  )}
                  {!esAdmin && s.estado === "pendiente" && (
                    <button type="button" className="gs-btn gs-btn-secundario" onClick={() => cancelar(s)}>
                      <LuBan aria-hidden="true" />
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {rechazando && (
        <ModalRechazo
          solicitud={rechazando}
          onCerrar={() => setRechazando(null)}
          onListo={(texto) => { setRechazando(null); onMensaje(texto); cargar(); }}
        />
      )}
    </section>
  );
};
