import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  LuSprout,
  LuPackage,
  LuRoute,
  LuBadgeCheck,
  LuClock,
  LuChevronRight,
  LuPlus,
  LuQrCode,
  LuHistory
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import {
  NOMBRE_ESTADO_LOTE,
  NOMBRE_ESTADO_CERTIFICACION,
  NOMBRE_TIPO_EVENTO,
  formatearFecha
} from "../utils/formatos";

import "./Paneles.css";


// ==========================================
// PANEL DEL PRODUCTOR
// Resumen de SUS lotes, eventos y
// certificaciones (el backend solo devuelve
// los datos que le pertenecen).
// ==========================================

const PanelProductor = () => {

  const { usuario } = useContext(AuthContext);

  const [lotes, setLotes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [certificaciones, setCertificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {
    const cargar = async () => {
      try {
        const [resLotes, resEventos, resCertificaciones] =
          await Promise.all([
            api.get("/lotes"),
            api.get("/trazabilidad"),
            api.get("/certificaciones")
          ]);

        setLotes(resLotes.data || []);
        setEventos(resEventos.data.eventos || []);
        setCertificaciones(resCertificaciones.data.certificaciones || []);

      } catch (err) {
        setError(
          err.response?.data?.mensaje ||
          "No se pudo cargar tu información"
        );
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);


  const lotesActivos = lotes.filter((l) => l.activo !== false);

  const aprobadas = certificaciones.filter(
    (c) => c.estado === "aprobada"
  ).length;

  const enTramite = certificaciones.filter(
    (c) => c.estado === "pendiente" || c.estado === "en_revision"
  ).length;

  const ultimosEventos = [...eventos]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5);


  if (cargando) {
    return <div className="pn-vacio">Cargando tu panel...</div>;
  }


  return (
    <div className="pn-pagina">

      {/* BIENVENIDA */}
      <section className="pn-bienvenida">
        <div>
          <h1>Hola, {usuario?.nombre}</h1>
          <p>
            {usuario?.empresa?.nombre
              ? `Productor de ${usuario.empresa.nombre}`
              : "Productor de cacao fino de aroma"}
          </p>

          <div className="pn-acciones-rapidas">
            <Link to="/trazabilidad" className="pn-btn pn-btn-claro">
              <LuPlus aria-hidden="true" />
              Registrar actividad
            </Link>

            <Link to="/certificaciones" className="pn-btn pn-btn-claro">
              <LuBadgeCheck aria-hidden="true" />
              Solicitar certificación
            </Link>

            <Link to="/qr" className="pn-btn pn-btn-claro">
              <LuQrCode aria-hidden="true" />
              Mis códigos QR
            </Link>
          </div>
        </div>

        <LuSprout className="pn-bienvenida-icono" aria-hidden="true" />
      </section>


      {error && <div className="pn-alerta pn-alerta-error">{error}</div>}

      {!usuario?.productor && (
        <div className="pn-alerta pn-alerta-error">
          Tu cuenta todavía no está vinculada a un productor. Pide al
          administrador que la vincule para ver tus lotes.
        </div>
      )}


      {/* RESUMEN */}
      <section className="pn-resumen" aria-label="Resumen">
        <div className="pn-dato kpi-azul">
          <span className="pn-dato-icono"><LuPackage aria-hidden="true" /></span>
          <div>
            <strong>{lotesActivos.length}</strong>
            <span>Lotes activos</span>
          </div>
        </div>

        <div className="pn-dato kpi-morado">
          <span className="pn-dato-icono"><LuRoute aria-hidden="true" /></span>
          <div>
            <strong>{eventos.length}</strong>
            <span>Actividades registradas</span>
          </div>
        </div>

        <div className="pn-dato kpi-verde">
          <span className="pn-dato-icono"><LuBadgeCheck aria-hidden="true" /></span>
          <div>
            <strong>{aprobadas}</strong>
            <span>Certificaciones aprobadas</span>
          </div>
        </div>

        <div className="pn-dato kpi-ambar">
          <span className="pn-dato-icono"><LuClock aria-hidden="true" /></span>
          <div>
            <strong>{enTramite}</strong>
            <span>Certificaciones en trámite</span>
          </div>
        </div>
      </section>


      <div className="pn-columnas">

        {/* MIS LOTES */}
        <section className="pn-seccion">
          <div className="pn-seccion-cabecera">
            <h2><LuPackage aria-hidden="true" />Mis lotes</h2>
            <Link to="/lotes" className="pn-enlace">
              Ver todos <LuChevronRight aria-hidden="true" />
            </Link>
          </div>

          {lotes.length === 0 ? (
            <div className="pn-vacio">
              Todavía no tienes lotes. La empresa es quien los registra.
            </div>
          ) : (
            <ul className="pn-lista">
              {lotes.slice(0, 6).map((lote) => (
                <li className="pn-item" key={lote._id}>
                  <div className="pn-item-principal">
                    <strong>{lote.codigo}</strong>
                    <span>
                      {lote.cantidad} {lote.unidad || "kg"} ·
                      {" "}Cosecha estimada: {formatearFecha(lote.fechaEstimadaCosecha)}
                    </span>
                  </div>

                  <span className={`pn-estado pn-estado-${lote.estado}`}>
                    {NOMBRE_ESTADO_LOTE[lote.estado] || lote.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>


        <div>

          {/* CERTIFICACIONES */}
          <section className="pn-seccion">
            <div className="pn-seccion-cabecera">
              <h2><LuBadgeCheck aria-hidden="true" />Certificaciones</h2>
              <Link to="/certificaciones" className="pn-enlace">
                Ver todas <LuChevronRight aria-hidden="true" />
              </Link>
            </div>

            {certificaciones.length === 0 ? (
              <div className="pn-vacio">Aún no has solicitado certificaciones.</div>
            ) : (
              <ul className="pn-lista">
                {certificaciones.slice(0, 4).map((c) => (
                  <li className="pn-item" key={c._id}>
                    <div className="pn-item-principal">
                      <strong>{c.tipoCertificacion}</strong>
                      <span>{c.lote?.codigo} · {c.codigo}</span>
                    </div>

                    <span className={`pn-estado pn-estado-${c.estado}`}>
                      {NOMBRE_ESTADO_CERTIFICACION[c.estado] || c.estado}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>


          {/* ÚLTIMAS ACTIVIDADES */}
          <section className="pn-seccion">
            <div className="pn-seccion-cabecera">
              <h2><LuHistory aria-hidden="true" />Últimas actividades</h2>
              <Link to="/trazabilidad" className="pn-enlace">
                Historial <LuChevronRight aria-hidden="true" />
              </Link>
            </div>

            {ultimosEventos.length === 0 ? (
              <div className="pn-vacio">Sin actividades registradas.</div>
            ) : (
              <ul className="pn-lista">
                {ultimosEventos.map((e) => (
                  <li className="pn-item" key={e._id}>
                    <div className="pn-item-principal">
                      <strong>{NOMBRE_TIPO_EVENTO[e.tipo] || e.tipo}</strong>
                      <span>{e.lote?.codigo} · {e.descripcion}</span>
                    </div>
                    <span className="pn-ayuda">{formatearFecha(e.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>

      </div>

    </div>
  );
};

export default PanelProductor;
