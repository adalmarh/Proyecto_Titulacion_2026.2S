import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LuQrCode,
  LuSearch,
  LuRefreshCw,
  LuEye,
  LuPlus,
  LuScanLine,
  LuPackage,
  LuCircleCheck,
  LuTriangleAlert,
  LuCircleDashed
} from "react-icons/lu";

import api from "../services/api";
import ModalQR from "../components/ModalQR";
import { usePermisos } from "../utils/permisos";
import {
  NOMBRE_ESTADO_LOTE,
  formatearFechaHora,
  nombreCompleto
} from "../utils/formatos";


// ==========================================================
// CÓDIGOS QR
// Estado del código QR de cada lote activo. Desde aquí se
// genera, consulta, descarga, regenera o desactiva (ModalQR).
// Al escanearlo, el consumidor final ve la consulta pública.
// ==========================================================

const CodigosQR = () => {

  const permisos = usePermisos();

  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [loteQR, setLoteQR] = useState(null);


  // ========================================
  // CARGAR LOTES Y EL QR DE CADA UNO
  // ========================================

  const cargar = useCallback(async () => {
    try {
      setError("");
      const respuesta = await api.get("/lotes");
      const lista = (Array.isArray(respuesta.data) ? respuesta.data : respuesta.data.lotes || [])
        .filter((l) => l.activo !== false);

      const conQR = await Promise.all(
        lista.map(async (lote) => {
          try {
            const r = await api.get(`/qr/lote/${lote._id}`);
            return { ...lote, qr: r.data.qr || null };
          } catch {
            // 404: el lote aún no tiene QR activo
            return { ...lote, qr: null };
          }
        })
      );

      setLotes(conQR);

    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudieron cargar los códigos QR");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);


  // ========================================
  // RESUMEN Y FILTROS
  // ========================================

  const totalConQR = lotes.filter((l) => l.qr).length;
  const totalEscaneos = lotes.reduce((suma, l) => suma + (l.qr?.totalEscaneos || 0), 0);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lotes.filter((l) => {
      const coincideTexto =
        !texto ||
        `${l.codigo} ${nombreCompleto(l.productor)}`.toLowerCase().includes(texto);

      const coincideFiltro =
        filtro === "todos" || (filtro === "con" ? Boolean(l.qr) : !l.qr);

      return coincideTexto && coincideFiltro;
    });
  }, [lotes, busqueda, filtro]);


  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuQrCode aria-hidden="true" />
            Códigos QR
          </h1>
          <p>
            Cada lote tiene un código QR dinámico: al escanearlo se muestra su
            origen, su trazabilidad y sus certificaciones vigentes.
          </p>
        </div>

        <button className="gs-btn gs-btn-secundario" onClick={cargar}>
          <LuRefreshCw aria-hidden="true" />
          Actualizar
        </button>
      </div>


      {error && (
        <div className="gs-alerta gs-alerta-error">
          <LuTriangleAlert aria-hidden="true" />
          {error}
        </div>
      )}


      {/* RESUMEN */}
      <section className="gs-resumen" aria-label="Resumen">
        <div className="gs-kpi kpi-azul">
          <span className="gs-kpi-icono"><LuPackage aria-hidden="true" /></span>
          <div>
            <strong>{lotes.length}</strong>
            <span>Lotes activos</span>
          </div>
        </div>
        <div className="gs-kpi kpi-verde">
          <span className="gs-kpi-icono"><LuCircleCheck aria-hidden="true" /></span>
          <div>
            <strong>{totalConQR}</strong>
            <span>Con código QR</span>
          </div>
        </div>
        <div className="gs-kpi kpi-ambar">
          <span className="gs-kpi-icono"><LuCircleDashed aria-hidden="true" /></span>
          <div>
            <strong>{lotes.length - totalConQR}</strong>
            <span>Sin código QR</span>
          </div>
        </div>
        <div className="gs-kpi kpi-morado">
          <span className="gs-kpi-icono"><LuScanLine aria-hidden="true" /></span>
          <div>
            <strong>{totalEscaneos}</strong>
            <span>Escaneos en total</span>
          </div>
        </div>
      </section>


      {/* FILTROS */}
      <div className="gs-filtros">
        <div className="gs-buscador">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por código de lote o productor"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar lotes"
          />
        </div>

        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por código QR">
          <option value="todos">Todos los lotes</option>
          <option value="con">Con código QR</option>
          <option value="sin">Sin código QR</option>
        </select>
      </div>


      {/* TABLA */}
      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando códigos QR...</div>
        ) : filtrados.length === 0 ? (
          <div className="gs-vacio">
            <LuQrCode aria-hidden="true" />
            <h3>{lotes.length === 0 ? "No hay lotes activos" : "Ningún lote coincide con los filtros"}</h3>
            <p>
              {lotes.length === 0
                ? "Los códigos QR se generan para los lotes registrados."
                : "Cambia la búsqueda o el filtro."}
            </p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Productor</th>
                  <th>Etapa</th>
                  <th>Código QR</th>
                  <th>Escaneos</th>
                  <th>Último escaneo</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((lote) => (
                  <tr key={lote._id}>
                    <td>
                      <span className="gs-codigo">{lote.codigo}</span>
                      <span className="gs-secundario">{lote.producto}</span>
                    </td>

                    <td>{nombreCompleto(lote.productor)}</td>

                    <td>
                      <span className={`gs-estado gs-estado-${lote.estado}`}>
                        {NOMBRE_ESTADO_LOTE[lote.estado] || lote.estado}
                      </span>
                    </td>

                    <td>
                      {lote.qr ? (
                        <span className="gs-etiqueta gs-activo">Activo</span>
                      ) : (
                        <span className="gs-etiqueta gs-inactivo">Sin generar</span>
                      )}
                    </td>

                    <td>{lote.qr ? lote.qr.totalEscaneos || 0 : "—"}</td>

                    <td style={{ whiteSpace: "nowrap" }}>
                      {lote.qr?.ultimoEscaneo ? formatearFechaHora(lote.qr.ultimoEscaneo) : "—"}
                    </td>

                    <td>
                      {lote.qr ? (
                        <button className="gs-btn gs-btn-icono" onClick={() => setLoteQR(lote)}>
                          <LuEye aria-hidden="true" />
                          Ver QR
                        </button>
                      ) : permisos.generarQR ? (
                        <button className="gs-btn gs-btn-principal" onClick={() => setLoteQR(lote)}>
                          <LuPlus aria-hidden="true" />
                          Generar
                        </button>
                      ) : (
                        <span className="gs-ayuda">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {loteQR && (
        <ModalQR
          lote={loteQR}
          onCerrar={() => setLoteQR(null)}
          onCambio={cargar}
        />
      )}

    </div>
  );
};

export default CodigosQR;
