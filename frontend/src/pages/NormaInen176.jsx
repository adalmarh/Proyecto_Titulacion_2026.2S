import { useContext } from "react";
import { Link } from "react-router-dom";

import {
  LuSprout,
  LuArrowLeft,
  LuBookOpen,
  LuExternalLink
} from "react-icons/lu";

import { AuthContext } from "../context/AuthContext";
import {
  NORMA,
  URL_TEXTO_NORMA,
  PARAMETROS_INEN,
  REQUISITOS_GENERALES_INEN,
  textoLimite
} from "../utils/normaInen176";

import "./Privacidad.css";


// ==========================================================
// NORMA, BASES Y PARÁMETROS DEL CERTIFICADO (página pública)
// Ruta /normativa/inen-176. El anexo técnico del certificado
// PDF enlaza aquí: explica en qué norma se basa el certificado,
// qué se mide, los límites de cada grado y cómo se calcula.
// Usa los estilos de la página de privacidad (prefijo pv-).
// ==========================================================

const NormaInen176 = () => {

  const { usuario } = useContext(AuthContext);

  return (
    <div className="pv">

      <header className="pv-cabecera">
        <div className="pv-ancho">
          <Link to={usuario ? "/dashboard" : "/"} className="pv-marca">
            <LuSprout aria-hidden="true" />
            RutaCacao
          </Link>
        </div>
      </header>

      <main className="pv-ancho pv-contenido">

        <Link to={usuario ? "/dashboard" : "/"} className="pv-volver">
          <LuArrowLeft aria-hidden="true" />
          {usuario ? "Volver al sistema" : "Ir al inicio de sesión"}
        </Link>

        <h1>
          <LuBookOpen aria-hidden="true" />
          Norma, bases y parámetros del certificado
        </h1>
        <p className="pv-fecha">{NORMA.codigo} · {NORMA.titulo} · {NORMA.revision}</p>

        <p className="pv-resumen">
          Los certificados de RutaCacao se emiten según la Norma Técnica Ecuatoriana{" "}
          <strong>{NORMA.codigo} «{NORMA.titulo}»</strong>, del {NORMA.entidad}.
          El certificador analiza una muestra del lote, registra los resultados en el sistema
          y el sistema clasifica el cacao en Grado 1, Grado 2 o Grado 3 con los límites de la
          Tabla 1 de la norma. Solo se aprueba un certificado si el lote cumple la norma.
        </p>

        <section>
          <h2>1. Qué establece la norma</h2>
          <p>
            La {NORMA.codigo} fija los requisitos de calidad que deben cumplir los granos de
            cacao en Ecuador y los criterios para clasificarlos en tres grados. Incluye el
            muestreo (NTE INEN-ISO 2292), la prueba de corte (NTE INEN-ISO 1114), la medición
            de la humedad (NTE INEN-ISO 2291) y los métodos para granos defectuosos, material
            relacionado y materia extraña (anexos B y C de la norma).
          </p>
        </section>

        <section>
          <h2>2. Parámetros y límites de cada grado (Tabla 1)</h2>
          <div className="nm-tabla-envoltura">
            <table className="pv-tabla nm-tabla">
              <thead>
                <tr>
                  <th>Parámetro</th>
                  <th>Grado 1</th>
                  <th>Grado 2</th>
                  <th>Grado 3</th>
                  <th>Método de ensayo</th>
                </tr>
              </thead>
              <tbody>
                {PARAMETROS_INEN.map((p) => (
                  <tr key={p.clave}>
                    <td>{p.nombre}</td>
                    <td>{textoLimite(p, 0)}</td>
                    <td>{textoLimite(p, 1)}</td>
                    <td>{textoLimite(p, 2)}</td>
                    <td>{p.metodo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Los porcentajes de granos bien fermentados, violetas, pizarrosos y mohosos se
            obtienen con la prueba de corte de 100 granos. Los granos defectuosos incluyen
            granos dañados por insectos, germinados, negros, planos o vanos y partidos.
          </p>
        </section>

        <section>
          <h2>3. Requisitos generales (sección 5)</h2>
          <ul>
            {REQUISITOS_GENERALES_INEN.map((r) => <li key={r.clave}>{r.nombre}.</li>)}
          </ul>
        </section>

        <section>
          <h2>4. Cómo calcula RutaCacao el grado</h2>
          <ul>
            <li>Cada parámetro recibe el mejor grado cuyo límite cumple.</li>
            <li>
              El grado del lote es el del parámetro con la peor clasificación: un lote es
              Grado 1 solo si todos sus parámetros cumplen el Grado 1.
            </li>
            <li>
              Si un parámetro no cumple ni siquiera el Grado 3, o el grano tiene olor a humo
              o está infestado, el lote no cumple la norma y la certificación no se puede aprobar.
            </li>
            <li>
              El sistema vuelve a calcular el grado en el servidor al aprobar, así que el grado
              impreso en el certificado no depende de lo que escriba a mano el certificador.
            </li>
          </ul>
          <p>
            Los resultados del análisis de cada lote aparecen en el anexo técnico del certificado
            PDF, junto con el grado obtenido.
          </p>
        </section>

        <section>
          <h2>5. Fuentes</h2>
          <ul>
            <li>
              <a href={URL_TEXTO_NORMA} target="_blank" rel="noreferrer">
                Texto de la {NORMA.codigo} «{NORMA.titulo}» (PDF)
                {" "}<LuExternalLink aria-hidden="true" className="nm-icono" />
              </a>
              {" "}— copia publicada por la Asociación Nacional de Exportadores de Cacao del Ecuador (ANECACAO).
            </li>
            <li>
              La norma oficial y sus actualizaciones se publican en el catálogo del {NORMA.entidad}.
            </li>
          </ul>
        </section>

      </main>
    </div>
  );
};

export default NormaInen176;
