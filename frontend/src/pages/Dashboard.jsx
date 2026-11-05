import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  LuLayoutDashboard,
  LuRefreshCw,
  LuPackage,
  LuTractor,
  LuBadgeCheck,
  LuRoute,
  LuChartBar,
  LuHistory,
  LuChevronRight,
  LuTriangleAlert
} from "react-icons/lu";

import api from "../services/api";
import { usePermisos, ROLES } from "../utils/permisos";
import {
  NOMBRE_ESTADO_LOTE,
  NOMBRE_ESTADO_CERTIFICACION,
  NOMBRE_TIPO_EVENTO,
  formatearFecha,
  nombreCompleto
} from "../utils/formatos";
import { iconoEvento } from "../utils/iconos";


// ==========================================================
// DASHBOARD (administrador y asociación)
// Los datos ya llegan filtrados por el backend según el rol:
// la asociación solo ve los de su asociación.
// ==========================================================

const lista = (datos, clave) =>
  Array.isArray(datos) ? datos : datos?.[clave] || [];


// Gráfico de barras horizontales de una sola serie
const Barras = ({ filas, icono = false }) => {
  const maximo = Math.max(1, ...filas.map((f) => f.cantidad));

  return (
    <ul className="gs-barras">
      {filas.map((fila) => {
        const Icono = icono ? iconoEvento(fila.clave) : null;

        return (
          <li
            key={fila.clave}
            className="gs-barra-fila"
            title={`${fila.nombre}: ${fila.cantidad}`}
          >
            <span className="gs-barra-etiqueta">
              {Icono && (
                <Icono
                  aria-hidden="true"
                  style={{ width: 15, height: 15, marginRight: 6, verticalAlign: -2, color: "#2f855a" }}
                />
              )}
              {fila.nombre}
            </span>
            <span className="gs-barra-pista" aria-hidden="true">
              {fila.cantidad > 0 && (
                <span
                  className="gs-barra-valor"
                  style={{ display: "block", width: `${(fila.cantidad / maximo) * 100}%` }}
                />
              )}
            </span>
            <span className="gs-barra-cifra">{fila.cantidad}</span>
          </li>
        );
      })}
    </ul>
  );
};


const Dashboard = () => {

  const { rol } = usePermisos();
  const esAsociacion = rol === ROLES.ASOCIACION;

  const [lotes, setLotes] = useState([]);
  const [productores, setProductores] = useState([]);
  const [certificaciones, setCertificaciones] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");


  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const [resLotes, resProductores, resCertificaciones, resEventos] =
        await Promise.all([
          api.get("/lotes"),
          api.get("/productores"),
          api.get("/certificaciones"),
          api.get("/trazabilidad")
        ]);

      setLotes(lista(resLotes.data, "lotes"));
      setProductores(lista(resProductores.data, "productores"));
      setCertificaciones(lista(resCertificaciones.data, "certificaciones"));
      setEventos(lista(resEventos.data, "eventos"));

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo cargar la información del dashboard"
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);


  // ---------- Cálculos ----------

  const resumen = useMemo(() => {
    const contar = (arr, fn) => arr.filter(fn).length;

    const lotesPorEtapa = Object.entries(NOMBRE_ESTADO_LOTE)
      .map(([clave, nombre]) => ({
        clave,
        nombre,
        cantidad: contar(lotes, (l) => l.estado === clave && l.activo !== false)
      }));

    const actividadesPorTipo = Object.entries(NOMBRE_TIPO_EVENTO)
      .map(([clave, nombre]) => ({
        clave,
        nombre,
        cantidad: contar(eventos, (e) => e.tipo === clave)
      }))
      .filter((f) => f.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad);

    const certificacionesPorEstado = Object.entries(NOMBRE_ESTADO_CERTIFICACION)
      .map(([clave, nombre]) => ({
        clave,
        nombre,
        cantidad: contar(certificaciones, (c) => c.estado === clave)
      }));

    return {
      lotesActivos: contar(lotes, (l) => l.activo !== false),
      productoresActivos: contar(productores, (p) => p.activo !== false),
      aprobadas: contar(certificaciones, (c) => c.estado === "aprobada"),
      porRevisar: contar(
        certificaciones,
        (c) => c.estado === "pendiente" || c.estado === "en_revision"
      ),
      lotesPorEtapa,
      actividadesPorTipo,
      certificacionesPorEstado,
      lotesRecientes: [...lotes]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
      eventosRecientes: [...eventos]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 6)
    };
  }, [lotes, productores, certificaciones, eventos]);


  if (cargando) {
    return <div className="gs-vacio">Cargando el dashboard...</div>;
  }


  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuLayoutDashboard aria-hidden="true" />
            Dashboard
          </h1>
          <p>
            {esAsociacion
              ? "Resumen de los productores, lotes y certificaciones de tu asociación."
              : "Resumen general del sistema de trazabilidad de cacao fino de aroma."}
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
            <strong>{resumen.lotesActivos}</strong>
            <span>Lotes activos de {lotes.length}</span>
          </div>
        </div>

        <div className="gs-kpi kpi-morado">
          <span className="gs-kpi-icono"><LuTractor aria-hidden="true" /></span>
          <div>
            <strong>{resumen.productoresActivos}</strong>
            <span>Productores activos</span>
          </div>
        </div>

        <div className="gs-kpi kpi-verde">
          <span className="gs-kpi-icono"><LuBadgeCheck aria-hidden="true" /></span>
          <div>
            <strong>{resumen.aprobadas}</strong>
            <span>
              Certificaciones aprobadas
              {resumen.porRevisar > 0 && ` · ${resumen.porRevisar} en trámite`}
            </span>
          </div>
        </div>

        <div className="gs-kpi kpi-ambar">
          <span className="gs-kpi-icono"><LuRoute aria-hidden="true" /></span>
          <div>
            <strong>{eventos.length}</strong>
            <span>Actividades registradas</span>
          </div>
        </div>
      </section>


      <div className="gs-cuadricula">

        {/* LOTES POR ETAPA */}
        <section className="gs-panel">
          <div className="gs-panel-cabecera">
            <div>
              <h2><LuChartBar aria-hidden="true" />Lotes activos por etapa</h2>
              <p>En qué punto del proceso está cada lote</p>
            </div>
          </div>
          <div className="gs-panel-cuerpo">
            {resumen.lotesActivos === 0 ? (
              <p className="gs-ayuda">Todavía no hay lotes activos.</p>
            ) : (
              <Barras filas={resumen.lotesPorEtapa} />
            )}
          </div>
        </section>

        {/* CERTIFICACIONES */}
        <section className="gs-panel">
          <div className="gs-panel-cabecera">
            <div>
              <h2><LuBadgeCheck aria-hidden="true" />Certificaciones</h2>
              <p>Solicitudes según su estado</p>
            </div>
            <Link to="/certificaciones" className="gs-enlace">
              Ver todas
            </Link>
          </div>
          <ul className="gs-lista">
            {resumen.certificacionesPorEstado.map((fila) => (
              <li key={fila.clave}>
                <span className={`gs-estado gs-estado-${fila.clave}`}>
                  {fila.nombre}
                </span>
                <strong>{fila.cantidad}</strong>
              </li>
            ))}
          </ul>
        </section>

      </div>


      <div className="gs-cuadricula">

        {/* ACTIVIDADES POR TIPO */}
        <section className="gs-panel">
          <div className="gs-panel-cabecera">
            <div>
              <h2><LuRoute aria-hidden="true" />Actividades por tipo</h2>
              <p>Registros de trazabilidad acumulados</p>
            </div>
          </div>
          <div className="gs-panel-cuerpo">
            {resumen.actividadesPorTipo.length === 0 ? (
              <p className="gs-ayuda">Todavía no hay actividades registradas.</p>
            ) : (
              <Barras filas={resumen.actividadesPorTipo} icono />
            )}
          </div>
        </section>

        {/* LOTES RECIENTES */}
        <section className="gs-panel">
          <div className="gs-panel-cabecera">
            <div>
              <h2><LuPackage aria-hidden="true" />Lotes recientes</h2>
              <p>Últimos lotes registrados</p>
            </div>
            <Link to="/lotes" className="gs-enlace">
              Ver lotes
            </Link>
          </div>
          {resumen.lotesRecientes.length === 0 ? (
            <div className="gs-panel-cuerpo">
              <p className="gs-ayuda">Todavía no hay lotes registrados.</p>
            </div>
          ) : (
            <ul className="gs-lista">
              {resumen.lotesRecientes.map((lote) => (
                <li key={lote._id}>
                  <div>
                    <span className="gs-codigo">{lote.codigo}</span>
                    <span className="gs-secundario">
                      {nombreCompleto(lote.productor)} · {lote.cantidad} {lote.unidad || "kg"}
                    </span>
                  </div>
                  <span className={`gs-estado gs-estado-${lote.estado}`}>
                    {NOMBRE_ESTADO_LOTE[lote.estado] || lote.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>


      {/* ACTIVIDAD RECIENTE */}
      <section className="gs-panel">
        <div className="gs-panel-cabecera">
          <div>
            <h2><LuHistory aria-hidden="true" />Actividad reciente</h2>
            <p>Últimos registros de trazabilidad</p>
          </div>
          <Link to="/trazabilidad" className="gs-enlace">
            Ir a trazabilidad <LuChevronRight aria-hidden="true" style={{ verticalAlign: -3 }} />
          </Link>
        </div>

        {resumen.eventosRecientes.length === 0 ? (
          <div className="gs-panel-cuerpo">
            <p className="gs-ayuda">Todavía no hay actividades registradas.</p>
          </div>
        ) : (
          <ul className="gs-lista">
            {resumen.eventosRecientes.map((evento) => {
              const Icono = iconoEvento(evento.tipo);

              return (
                <li key={evento._id}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                    <span className="gs-linea-icono" aria-hidden="true">
                      <Icono />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span className="gs-principal">
                        {NOMBRE_TIPO_EVENTO[evento.tipo] || evento.tipo}
                        {" · "}
                        {evento.lote?.codigo}
                      </span>
                      <span className="gs-secundario">
                        {evento.descripcion}
                        {evento.responsable && ` · ${nombreCompleto(evento.responsable)}`}
                      </span>
                    </div>
                  </div>
                  <span className="gs-ayuda" style={{ whiteSpace: "nowrap" }}>
                    {formatearFecha(evento.fecha)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
};

export default Dashboard;
