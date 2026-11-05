import { useEffect, useMemo, useState } from "react";

import {
  LuBuilding2,
  LuPlus,
  LuPencil,
  LuPower,
  LuSearch,
  LuX,
  LuCircleCheck,
  LuTriangleAlert
} from "react-icons/lu";

import api from "../services/api";

// Estilos: styles/sistema.css (importado en main.jsx)


// ==========================================
// GESTIÓN DE ASOCIACIONES (solo administrador)
// ==========================================

const formularioVacio = {
  nombre: "",
  ruc: "",
  direccion: "",
  provincia: "",
  canton: "",
  telefono: "",
  email: "",
  representante: ""
};


const Asociaciones = () => {

  const [asociaciones, setAsociaciones] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);


  // ========================================
  // CARGAR DATOS
  // ========================================

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError("");

      const respuesta = await api.get("/asociaciones");
      setAsociaciones(respuesta.data || []);

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudieron cargar las asociaciones"
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);


  const asociacionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return asociaciones.filter(
      (a) =>
        !texto ||
        `${a.nombre} ${a.ruc} ${a.canton} ${a.provincia}`
          .toLowerCase()
          .includes(texto)
    );
  }, [asociaciones, busqueda]);


  // ========================================
  // FORMULARIO
  // ========================================

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario(formularioVacio);
    setError("");
    setMensaje("");
    setModalAbierto(true);
  };

  const abrirEdicion = (a) => {
    setEditando(a);
    setFormulario(
      Object.fromEntries(
        Object.keys(formularioVacio).map((campo) => [campo, a[campo] || ""])
      )
    );
    setError("");
    setMensaje("");
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (!guardando) {
      setModalAbierto(false);
    }
  };

  const cambiarCampo = (event) => {
    const { name, value } = event.target;
    setFormulario((anterior) => ({ ...anterior, [name]: value }));
  };

  const guardar = async (event) => {
    event.preventDefault();
    setError("");

    try {
      setGuardando(true);

      const respuesta = editando
        ? await api.put(`/asociaciones/${editando._id}`, formulario)
        : await api.post("/asociaciones", formulario);

      setMensaje(
        respuesta.data.mensaje ||
        (editando
          ? "Asociación actualizada correctamente"
          : "Asociación creada correctamente")
      );
      setModalAbierto(false);
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo guardar la asociación"
      );
    } finally {
      setGuardando(false);
    }
  };


  // ========================================
  // DESACTIVAR
  // ========================================

  const desactivar = async (a) => {
    const confirmar = window.confirm(
      `¿Desactivar la asociación «${a.nombre}»? ` +
      "Sus datos se conservan, pero no podrá usarse en registros nuevos."
    );

    if (!confirmar) {
      return;
    }

    try {
      setError("");
      const respuesta = await api.patch(`/asociaciones/${a._id}/desactivar`);
      setMensaje(
        respuesta.data.mensaje ||
        "Asociación desactivada correctamente"
      );
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo desactivar la asociación"
      );
    }
  };


  // Campo de texto del formulario
  const campo = (nombre, etiqueta, props = {}) => (
    <div className={`gs-campo ${props.ancho ? "gs-campo-ancho" : ""}`}>
      <label htmlFor={`a-${nombre}`}>{etiqueta}</label>
      <input
        id={`a-${nombre}`}
        name={nombre}
        value={formulario[nombre]}
        onChange={cambiarCampo}
        type={props.type || "text"}
        required={props.required}
        inputMode={props.inputMode}
      />
    </div>
  );


  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuBuilding2 aria-hidden="true" />
            Asociaciones
          </h1>
          <p>
            Registra las asociaciones de productores de cacao fino de aroma.
          </p>
        </div>

        <button
          className="gs-btn gs-btn-principal"
          onClick={abrirNuevo}
        >
          <LuPlus aria-hidden="true" />
          Nueva asociación
        </button>
      </div>


      {mensaje && (
        <div className="gs-alerta gs-alerta-exito">
          <LuCircleCheck aria-hidden="true" />
          {mensaje}
        </div>
      )}

      {error && !modalAbierto && (
        <div className="gs-alerta gs-alerta-error">
          <LuTriangleAlert aria-hidden="true" />
          {error}
        </div>
      )}


      <div className="gs-filtros">
        <div className="gs-buscador">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nombre, RUC o cantón"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar asociaciones"
          />
        </div>
      </div>


      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando asociaciones...</div>
        ) : asociacionesFiltradas.length === 0 ? (
          <div className="gs-vacio">
            <LuBuilding2 aria-hidden="true" />
            <h3>No hay asociaciones para mostrar</h3>
            <p>Registra la primera con el botón «Nueva asociación».</p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Asociación</th>
                  <th>RUC</th>
                  <th>Ubicación</th>
                  <th>Representante</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {asociacionesFiltradas.map((a) => (
                  <tr
                    key={a._id}
                    className={a.activa === false ? "gs-fila-inactiva" : ""}
                  >
                    <td>
                      <span className="gs-principal">{a.nombre}</span>
                      {a.email && (
                        <span className="gs-secundario">{a.email}</span>
                      )}
                    </td>

                    <td>{a.ruc}</td>

                    <td>
                      <span>{a.canton}</span>
                      <span className="gs-secundario">{a.provincia}</span>
                    </td>

                    <td>
                      <span>{a.representante || "—"}</span>
                      {a.telefono && (
                        <span className="gs-secundario">{a.telefono}</span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`gs-etiqueta ${
                          a.activa === false ? "gs-inactivo" : "gs-activo"
                        }`}
                      >
                        {a.activa === false ? "Inactiva" : "Activa"}
                      </span>
                    </td>

                    <td>
                      <div className="gs-acciones">
                        <button
                          className="gs-btn gs-btn-icono"
                          onClick={() => abrirEdicion(a)}
                          disabled={a.activa === false}
                        >
                          <LuPencil aria-hidden="true" />
                          Editar
                        </button>

                        {a.activa !== false && (
                          <button
                            className="gs-btn gs-btn-peligro"
                            onClick={() => desactivar(a)}
                          >
                            <LuPower aria-hidden="true" />
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {modalAbierto && (
        <div className="gs-modal-fondo" onClick={cerrarModal}>
          <div
            className="gs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-asociacion"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gs-modal-cabecera">
              <div>
                <h2 id="titulo-asociacion">
                  {editando ? "Editar asociación" : "Nueva asociación"}
                </h2>
                <p>Los campos con * son obligatorios.</p>
              </div>

              <button
                className="gs-cerrar"
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                <LuX aria-hidden="true" />
              </button>
            </div>

            <form className="gs-formulario" onSubmit={guardar}>

              {error && (
                <div className="gs-alerta gs-alerta-error">
                  <LuTriangleAlert aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="gs-campos">
                {campo("nombre", "Nombre *", { required: true, ancho: true })}
                {campo("ruc", "RUC *", { required: true, inputMode: "numeric" })}
                {campo("representante", "Representante legal")}
                {campo("provincia", "Provincia *", { required: true })}
                {campo("canton", "Cantón *", { required: true })}
                {campo("direccion", "Dirección *", { required: true, ancho: true })}
                {campo("telefono", "Teléfono", { inputMode: "tel" })}
                {campo("email", "Correo electrónico", { type: "email" })}
              </div>

              <div className="gs-botones-modal">
                <button
                  type="button"
                  className="gs-btn gs-btn-secundario"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="gs-btn gs-btn-principal"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : editando
                      ? "Guardar cambios"
                      : "Registrar asociación"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Asociaciones;
