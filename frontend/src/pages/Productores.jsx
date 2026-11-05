import { useEffect, useMemo, useState } from "react";

import {
  LuTractor,
  LuPlus,
  LuPencil,
  LuPower,
  LuSearch,
  LuX,
  LuCircleCheck,
  LuTriangleAlert
} from "react-icons/lu";

import api from "../services/api";
import { usePermisos, ROLES } from "../utils/permisos";

// Estilos: styles/sistema.css (importado en main.jsx)


// ==========================================
// GESTIÓN DE PRODUCTORES
// Administrador: todos los productores.
// Asociación: solo los de su asociación (el
// backend la asigna automáticamente).
// ==========================================

const formularioVacio = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  email: "",
  direccion: "",
  asociacion: ""
};

const idDe = (valor) =>
  (valor && typeof valor === "object" ? valor._id : valor) || "";


const Productores = () => {

  const { rol } = usePermisos();
  const esAdmin = rol === ROLES.ADMIN;

  const [productores, setProductores] = useState([]);
  const [asociaciones, setAsociaciones] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroAsociacion, setFiltroAsociacion] = useState("");

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

      const [resProductores, resAsociaciones] = await Promise.all([
        api.get("/productores"),
        api.get("/asociaciones")
      ]);

      setProductores(resProductores.data || []);
      setAsociaciones(resAsociaciones.data || []);

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudieron cargar los productores"
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);


  // ========================================
  // FILTRAR LISTA
  // ========================================

  const productoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return productores.filter((p) => {
      const coincideTexto =
        !texto ||
        `${p.nombre} ${p.apellido} ${p.cedula}`
          .toLowerCase()
          .includes(texto);

      const coincideAsociacion =
        !filtroAsociacion ||
        idDe(p.asociacion) === filtroAsociacion;

      return coincideTexto && coincideAsociacion;
    });
  }, [productores, busqueda, filtroAsociacion]);


  // ========================================
  // FORMULARIO
  // ========================================

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario({
      ...formularioVacio,
      // La asociación solo tiene una opción: la suya
      asociacion: asociaciones.length === 1 ? asociaciones[0]._id : ""
    });
    setError("");
    setMensaje("");
    setModalAbierto(true);
  };

  const abrirEdicion = (p) => {
    setEditando(p);
    setFormulario({
      nombre: p.nombre || "",
      apellido: p.apellido || "",
      cedula: p.cedula || "",
      telefono: p.telefono || "",
      email: p.email || "",
      direccion: p.direccion || "",
      asociacion: idDe(p.asociacion)
    });
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

    const datos = { ...formulario };

    // Solo el administrador puede cambiar la asociación
    // de un productor existente.
    if (editando && !esAdmin) {
      delete datos.asociacion;
    }

    try {
      setGuardando(true);

      const respuesta = editando
        ? await api.put(`/productores/${editando._id}`, datos)
        : await api.post("/productores", datos);

      setMensaje(respuesta.data.mensaje);
      setModalAbierto(false);
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo guardar el productor"
      );
    } finally {
      setGuardando(false);
    }
  };


  // ========================================
  // DESACTIVAR
  // ========================================

  const desactivar = async (p) => {
    const confirmar = window.confirm(
      `¿Desactivar al productor ${p.nombre} ${p.apellido}? ` +
      "Sus lotes se conservan, pero no podrá usarse en lotes nuevos."
    );

    if (!confirmar) {
      return;
    }

    try {
      setError("");
      const respuesta = await api.patch(`/productores/${p._id}/desactivar`);
      setMensaje(respuesta.data.mensaje);
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo desactivar el productor"
      );
    }
  };


  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuTractor aria-hidden="true" />
            Productores
          </h1>
          <p>
            {esAdmin
              ? "Registra a los productores de cacao y su asociación."
              : "Registra y administra a los productores de tu asociación."}
          </p>
        </div>

        <button
          className="gs-btn gs-btn-principal"
          onClick={abrirNuevo}
        >
          <LuPlus aria-hidden="true" />
          Nuevo productor
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
            placeholder="Buscar por nombre o cédula"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar productores"
          />
        </div>

        {esAdmin && (
          <select
            value={filtroAsociacion}
            onChange={(e) => setFiltroAsociacion(e.target.value)}
            aria-label="Filtrar por asociación"
          >
            <option value="">Todas las asociaciones</option>
            {asociaciones.map((a) => (
              <option key={a._id} value={a._id}>
                {a.nombre}
              </option>
            ))}
          </select>
        )}
      </div>


      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando productores...</div>
        ) : productoresFiltrados.length === 0 ? (
          <div className="gs-vacio">
            <LuTractor aria-hidden="true" />
            <h3>No hay productores para mostrar</h3>
            <p>Registra al primer productor con el botón «Nuevo productor».</p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Productor</th>
                  <th>Cédula</th>
                  <th>Contacto</th>
                  {esAdmin && <th>Asociación</th>}
                  <th>Cuenta</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {productoresFiltrados.map((p) => (
                  <tr
                    key={p._id}
                    className={p.activo === false ? "gs-fila-inactiva" : ""}
                  >
                    <td>
                      <span className="gs-principal">
                        {p.nombre} {p.apellido}
                      </span>
                      {p.direccion && (
                        <span className="gs-secundario">{p.direccion}</span>
                      )}
                    </td>

                    <td>{p.cedula}</td>

                    <td>
                      <span>{p.telefono || "—"}</span>
                      {p.email && (
                        <span className="gs-secundario">{p.email}</span>
                      )}
                    </td>

                    {esAdmin && <td>{p.asociacion?.nombre || "—"}</td>}

                    <td>{p.usuario ? "Con acceso" : "Sin acceso"}</td>

                    <td>
                      <span
                        className={`gs-etiqueta ${
                          p.activo === false ? "gs-inactivo" : "gs-activo"
                        }`}
                      >
                        {p.activo === false ? "Inactivo" : "Activo"}
                      </span>
                    </td>

                    <td>
                      <div className="gs-acciones">
                        <button
                          className="gs-btn gs-btn-icono"
                          onClick={() => abrirEdicion(p)}
                          disabled={p.activo === false}
                        >
                          <LuPencil aria-hidden="true" />
                          Editar
                        </button>

                        {p.activo !== false && (
                          <button
                            className="gs-btn gs-btn-peligro"
                            onClick={() => desactivar(p)}
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
            aria-labelledby="titulo-productor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gs-modal-cabecera">
              <div>
                <h2 id="titulo-productor">
                  {editando ? "Editar productor" : "Nuevo productor"}
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

                <div className="gs-campo">
                  <label htmlFor="p-nombre">Nombre *</label>
                  <input id="p-nombre" name="nombre" value={formulario.nombre} onChange={cambiarCampo} required />
                </div>

                <div className="gs-campo">
                  <label htmlFor="p-apellido">Apellido *</label>
                  <input id="p-apellido" name="apellido" value={formulario.apellido} onChange={cambiarCampo} required />
                </div>

                <div className="gs-campo">
                  <label htmlFor="p-cedula">Cédula *</label>
                  <input
                    id="p-cedula"
                    name="cedula"
                    value={formulario.cedula}
                    onChange={cambiarCampo}
                    inputMode="numeric"
                    pattern={editando ? undefined : "[0-9]{10}"}
                    title="La cédula debe tener 10 dígitos"
                    required
                  />
                </div>

                <div className="gs-campo">
                  <label htmlFor="p-telefono">Teléfono</label>
                  <input id="p-telefono" name="telefono" value={formulario.telefono} onChange={cambiarCampo} inputMode="tel" />
                </div>

                <div className="gs-campo gs-campo-ancho">
                  <label htmlFor="p-email">Correo electrónico</label>
                  <input id="p-email" type="email" name="email" value={formulario.email} onChange={cambiarCampo} />
                </div>

                <div className="gs-campo gs-campo-ancho">
                  <label htmlFor="p-direccion">Dirección o finca</label>
                  <input id="p-direccion" name="direccion" value={formulario.direccion} onChange={cambiarCampo} />
                </div>

                <div className="gs-campo gs-campo-ancho">
                  <label htmlFor="p-asociacion">Asociación *</label>
                  <select
                    id="p-asociacion"
                    name="asociacion"
                    value={formulario.asociacion}
                    onChange={cambiarCampo}
                    disabled={!esAdmin}
                    required
                  >
                    <option value="">Seleccione la asociación</option>
                    {asociaciones
                      .filter((a) => a.activa !== false)
                      .map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.nombre}
                        </option>
                      ))}
                  </select>
                  {!esAdmin && (
                    <span className="gs-ayuda">
                      Los productores se registran en tu asociación.
                    </span>
                  )}
                </div>

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
                      : "Registrar productor"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Productores;
