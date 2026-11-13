import { useMemo } from "react";

import {
  LuChartColumn,
  LuCircleCheck,
  LuCircle,
  LuTriangleAlert
} from "react-icons/lu";

import { calcularAvance } from "../utils/etapasTrazabilidad";


// ==========================================================
// AVANCE DE LA TRAZABILIDAD (página Trazabilidad)
// Gráficas de colores con el porcentaje de cada etapa del
// lote y el avance total, calculados a partir de las
// actividades registradas (ver utils/etapasTrazabilidad.js).
// ==========================================================

const TEXTO_SITUACION = {
  completa: "Completa",
  en_curso: "En curso",
  siguiente: "Siguiente",
  incompleta: "Incompleta",
  pendiente: "Pendiente"
};


const AvanceTrazabilidad = ({ eventos }) => {

  const avance = useMemo(() => calcularAvance(eventos), [eventos]);

  return (
    <section className="gs-panel at" aria-labelledby="at-titulo">
      <div className="gs-panel-cabecera">
        <div>
          <h2 id="at-titulo"><LuChartColumn aria-hidden="true" />Avance de la trazabilidad</h2>
          <p>
            {avance.etapaActual
              ? <>Etapa actual: <strong>{avance.etapaActual}</strong></>
              : "Todas las etapas están completas"}
          </p>
        </div>
        <div className="at-total" aria-label={`Avance total ${avance.total} %`}>
          <strong>{avance.total} %</strong>
          <span>avance total</span>
        </div>
      </div>

      <div className="gs-panel-cuerpo">

        {/* Barra total: cada etapa ocupa 1/5 y se llena según su avance */}
        <div className="at-barra-total" aria-hidden="true">
          {avance.etapas.map((e) => (
            <span key={e.clave} className="at-tramo" title={`${e.nombre}: ${e.porcentaje} %`}>
              <span style={{ width: `${e.porcentaje}%`, background: e.color }} />
            </span>
          ))}
        </div>

        {avance.saltos.length > 0 && (
          <p className="at-aviso">
            <LuTriangleAlert aria-hidden="true" />
            Hay actividades de {avance.saltos.join(", ")} registradas antes de completar
            «{avance.etapaActual}». Revisa si falta registrar alguna actividad anterior.
          </p>
        )}

        <ol className="at-etapas">
          {avance.etapas.map((e, i) => (
            <li key={e.clave} className={`at-etapa at-${e.situacion}`}>
              <div className="at-fila">
                <span className="at-numero" style={{ background: e.color }} aria-hidden="true">{i + 1}</span>
                <span className="at-nombre">{e.nombre}</span>
              </div>

              <div className="at-fila at-meta">
                <span className={`at-situacion at-situacion-${e.situacion}`}>{TEXTO_SITUACION[e.situacion]}</span>
                <span className="at-porcentaje">{e.porcentaje} %</span>
              </div>

              <div
                className="at-barra"
                role="progressbar"
                aria-label={`${e.nombre}: ${e.hechas} de ${e.total} actividades`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={e.porcentaje}
                title={`${e.nombre}: ${e.hechas} de ${e.total} actividades (${e.porcentaje} %)`}
              >
                <span style={{ width: `${e.porcentaje}%`, background: e.color }} />
              </div>

              <ul className="at-actividades">
                {e.actividades.map((a) => (
                  <li key={a.nombre} className={a.hecha ? "at-hecha" : "at-falta"}>
                    {a.hecha
                      ? <LuCircleCheck aria-hidden="true" />
                      : <LuCircle aria-hidden="true" />}
                    {a.nombre}
                    <span className="at-oculto">{a.hecha ? " (registrada)" : " (falta)"}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p className="gs-ayuda at-nota">
          Cada actividad vale lo mismo dentro de su etapa y cada etapa pesa 20 % del total.
          Una actividad repetida cuenta una sola vez.
        </p>
      </div>
    </section>
  );
};

export default AvanceTrazabilidad;
