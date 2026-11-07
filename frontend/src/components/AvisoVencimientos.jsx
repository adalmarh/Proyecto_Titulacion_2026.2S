import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { LuCalendarClock, LuCalendarX } from "react-icons/lu";

import api from "../services/api";
import { formatearFecha, nombreCompleto } from "../utils/formatos";


// ==========================================================
// AVISO DE VENCIMIENTOS (dashboard y paneles)
// Muestra las certificaciones aprobadas que vencen en los
// próximos 30 días y las que vencieron hace poco, dentro
// del alcance del usuario (el backend las filtra por rol).
// No muestra nada si no hay ninguna.
// ==========================================================

const cuando = (dias) => {
  if (dias <= 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence en ${dias} días`;
};

const haceCuanto = (dias) => {
  const n = Math.abs(dias);
  if (n <= 1) return "venció ayer";
  return `venció hace ${n} días`;
};


const AvisoVencimientos = ({ esProductor = false }) => {

  const [datos, setDatos] = useState(null);

  useEffect(() => {
    api.get("/certificaciones/avisos/vencimientos")
      .then((r) => setDatos(r.data))
      .catch(() => setDatos(null));
  }, []);

  if (!datos || (datos.porVencer.length === 0 && datos.vencidas.length === 0)) {
    return null;
  }

  const fila = (c, texto) => (
    <li key={c._id}>
      <strong>{c.codigo || c.tipoCertificacion}</strong>
      <span>
        {c.tipoCertificacion}
        {c.lote?.codigo && ` · lote ${c.lote.codigo}`}
        {!esProductor && c.lote?.productor && ` · ${nombreCompleto(c.lote.productor)}`}
      </span>
      <span className="av-cuando">
        {texto} ({formatearFecha(c.fechaVencimiento)})
      </span>
    </li>
  );

  return (
    <section className="av" aria-label="Avisos de vencimiento de certificaciones">

      {datos.porVencer.length > 0 && (
        <div className="av-bloque av-por-vencer">
          <LuCalendarClock aria-hidden="true" />
          <div>
            <h2>
              {datos.porVencer.length === 1
                ? "1 certificación vence en los próximos 30 días"
                : `${datos.porVencer.length} certificaciones vencen en los próximos 30 días`}
            </h2>
            <p>
              {esProductor
                ? "Solicita la renovación a tiempo para que tu lote siga mostrándose como certificado."
                : "Coordina la renovación con el productor antes de la fecha de vencimiento."}
            </p>
            <ul>{datos.porVencer.map((c) => fila(c, cuando(c.diasParaVencer)))}</ul>
          </div>
        </div>
      )}

      {datos.vencidas.length > 0 && (
        <div className="av-bloque av-vencidas">
          <LuCalendarX aria-hidden="true" />
          <div>
            <h2>
              {datos.vencidas.length === 1
                ? "1 certificación venció en los últimos 30 días"
                : `${datos.vencidas.length} certificaciones vencieron en los últimos 30 días`}
            </h2>
            <p>
              El código QR de esos lotes ya las muestra como vencidas.
              {esProductor && " Puedes solicitar una nueva certificación."}
            </p>
            <ul>{datos.vencidas.map((c) => fila(c, haceCuanto(c.diasParaVencer)))}</ul>
          </div>
        </div>
      )}

      <Link to="/certificaciones" className="av-enlace">Ver certificaciones</Link>
    </section>
  );
};

export default AvisoVencimientos;
