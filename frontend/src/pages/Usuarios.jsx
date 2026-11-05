import { useContext, useEffect, useMemo, useState } from "react";

import {
  LuUserCog,
  LuUserPlus,
  LuPencil,
  LuUserX,
  LuUserCheck,
  LuSearch,
  LuX,
  LuCircleCheck,
  LuTriangleAlert,
  LuUsers
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { NOMBRE_ROL, ROLES } from "../utils/permisos";

// Estilos: styles/sistema.css (importado en main.jsx)


// ==========================================
// GESTIÓN DE USUARIOS (solo administrador)
// ==========================================

const formularioVacio = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  rol: ROLES.PRODUCTOR,
  asociacion: "",
  productor: ""
};

const idDe = (valor) =>
  (valor && typeof valor === "object" ? valor._id : valor) || "";


const Usuarios = () => {

  const { usuario: usuarioActual } = useContext(AuthContext);

  const [usuarios, setUsuarios] = useState([]);
  const [asociaciones, setAsociaciones] = useState([]);
  const [productores, setProductores] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

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

      const [resUsuarios, resAsociaciones, resProductores] =
        await Promise.all([
          api.get("/usuarios"),
          api.get("/asociaciones"),
          api.get("/productores")
        ]);

      setUsuarios(resUsuarios.data.usuarios || []);
      setAsociaciones(resAsociaciones.data || []);
      setProductores(resProductores.data || []);

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudieron cargar los usuarios"
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

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return usuarios.filter((u) => {
      const coincideTexto =
        !texto ||
        `${u.nombre} ${u.apellido} ${u.email}`
          .toLowerCase()
          .includes(texto);

      const coincideRol = !filtroRol || u.rol === filtroRol;

      return coincideTexto && coincideRol;
    });
  }, [usuarios, busqueda, filtroRol]);


  // Productores que todavía no tienen cuenta
  // (más el que ya tiene el usuario que se edita)
  const productoresDisponibles = productores.filter(
    (p) =>
      p.activo !== false &&
      (!p.usuario || idDe(p.usuario) === editando?._id)
  );


  // ========================================
  // ABRIR / CERRAR FORMULARIO
  // ========================================

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario(formularioVacio);
    setError("");
    setMensaje("");
    setModalAbierto(true);
  };

  const abrirEdicion = (u) => {
    setEditando(u);
    setFormulario({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      password: "",
      rol: u.rol,
      asociacion: idDe(u.asociacion),
      productor: idDe(u.productor)
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

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value
    }));
  };


  // ========================================
  // GUARDAR
  // ========================================

  const guardar = async (event) => {
    event.preventDefault();
    setError("");

    if (!editando && formulario.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    const datos = {
      nombre: formulario.nombre.trim(),
      apellido: formulario.apellido.trim(),
      email: formulario.email.trim(),
      rol: formulario.rol
    };

    if (formulario.password) {
      datos.password = formulario.password;
    }

    if (formulario.rol === ROLES.ASOCIACION) {
      datos.asociacion = formulario.asociacion;
    }

    if (formulario.rol === ROLES.PRODUCTOR) {
      datos.productor = formulario.productor;
    }

    try {
      setGuardando(true);

      const respuesta = editando
        ? await api.put(`/usuarios/${editando._id}`, datos)
        : await api.post("/usuarios", datos);

      setMensaje(respuesta.data.mensaje);
      setModalAbierto(false);
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo guardar el usuario"
      );
    } finally {
      setGuardando(false);
    }
  };


  // ========================================
  // ACTIVAR / DESACTIVAR
  // ========================================

  const cambiarEstado = async (u) => {
    const activar = !u.activo;

    const confirmar = window.confirm(
      activar
        ? `¿Activar la cuenta de ${u.nombre} ${u.apellido}?`
        : `¿Desactivar la cuenta de ${u.nombre} ${u.apellido}? No podrá iniciar sesión.`
    );

    if (!confirmar) {
      return;
    }

    try {
      setError("");
      const respuesta = await api.patch(
        `/usuarios/${u._id}/estado`,
        { activo: activar }
      );

      setMensaje(respuesta.data.mensaje);
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo cambiar el estado del usuario"
      );
    }
  };


  // ========================================
  // VÍNCULO SEGÚN EL ROL (columna de la tabla)
  // ========================================

  const descripcionVinculo = (u) => {
    if (u.rol === ROLES.ASOCIACION) {
      return u.asociacion?.nombre || (
        <span className="gs-aviso">Sin asociación vinculada</span>
      );
    }

    if (u.rol === ROLES.PRODUCTOR) {
      return u.productor
        ? `${u.productor.nombre} ${u.productor.apellido}`
        : <span className="gs-aviso">Sin productor vinculado</span>;
    }

    return "—";
  };

  const esUsuarioActual = (u) =>
    String(u._id) === String(usuarioActual?.id || usuarioActual?._id);


  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="gs-pagina">

      {/* ENCABEZADO */}
      <div className="gs-encabezado">
        <div>
          <h1>
            <LuUserCog aria-hidden="true" />
            Usuarios
          </h1>
          <p>
            Crea las cuentas de acceso y vincúlalas con su
            asociación o productor según el rol.
          </p>
        </div>

        <button
          className="gs-btn gs-btn-principal"
          onClick={abrirNuevo}
        >
          <LuUserPlus aria-hidden="true" />
          Nuevo usuario
        </button>
      </div>


      {/* MENSAJES */}
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


      {/* FILTROS */}
      <div className="gs-filtros">
        <div className="gs-buscador">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nombre o correo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar usuarios"
          />
        </div>

        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {Object.values(ROLES).map((rol) => (
            <option key={rol} value={rol}>
              {NOMBRE_ROL[rol]}
            </option>
          ))}
        </select>
      </div>


      {/* TABLA */}
      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando usuarios...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="gs-vacio">
            <LuUsers aria-hidden="true" />
            <h3>No hay usuarios para mostrar</h3>
            <p>Cambia la búsqueda o crea un usuario nuevo.</p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Vinculado a</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr
                    key={u._id}
                    className={u.activo ? "" : "gs-fila-inactiva"}
                  >
                    <td>
                      <span className="gs-principal">
                        {u.nombre} {u.apellido}
                        {esUsuarioActual(u) && " (tú)"}
                      </span>
                      <span className="gs-secundario">{u.email}</span>
                    </td>

                    <td>
                      <span className={`gs-etiqueta gs-rol-${u.rol}`}>
                        {NOMBRE_ROL[u.rol]}
                      </span>
                    </td>

                    <td>{descripcionVinculo(u)}</td>

                    <td>
                      <span
                        className={`gs-etiqueta ${
                          u.activo ? "gs-activo" : "gs-inactivo"
                        }`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="gs-acciones">
                        <button
                          className="gs-btn gs-btn-icono"
                          onClick={() => abrirEdicion(u)}
                        >
                          <LuPencil aria-hidden="true" />
                          Editar
                        </button>

                        {!esUsuarioActual(u) && (
                          <button
                            className={`gs-btn ${
                              u.activo ? "gs-btn-peligro" : "gs-btn-exito"
                            }`}
                            onClick={() => cambiarEstado(u)}
                          >
                            {u.activo ? (
                              <LuUserX aria-hidden="true" />
                            ) : (
                              <LuUserCheck aria-hidden="true" />
                            )}
                            {u.activo ? "Desactivar" : "Activar"}
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


      {/* MODAL CREAR / EDITAR */}
      {modalAbierto && (
        <div className="gs-modal-fondo" onClick={cerrarModal}>
          <div
            className="gs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-usuario"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gs-modal-cabecera">
              <div>
                <h2 id="titulo-usuario">
                  {editando ? "Editar usuario" : "Nuevo usuario"}
                </h2>
                <p>
                  {editando
                    ? "Deja la contraseña vacía para conservar la actual."
                    : "La persona iniciará sesión con este correo y contraseña."}
                </p>
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
                  <label htmlFor="u-nombre">Nombre</label>
                  <input
                    id="u-nombre"
                    name="nombre"
                    value={formulario.nombre}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="gs-campo">
                  <label htmlFor="u-apellido">Apellido</label>
                  <input
                    id="u-apellido"
                    name="apellido"
                    value={formulario.apellido}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="gs-campo">
                  <label htmlFor="u-email">Correo electrónico</label>
                  <input
                    id="u-email"
                    type="email"
                    name="email"
                    value={formulario.email}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="gs-campo">
                  <label htmlFor="u-password">
                    {editando ? "Nueva contraseña" : "Contraseña"}
                  </label>
                  <input
                    id="u-password"
                    type="password"
                    name="password"
                    value={formulario.password}
                    onChange={cambiarCampo}
                    minLength={6}
                    required={!editando}
                    autoComplete="new-password"
                  />
                  <span className="gs-ayuda">Mínimo 6 caracteres.</span>
                </div>

                <div className="gs-campo gs-campo-ancho">
                  <label htmlFor="u-rol">Rol</label>
                  <select
                    id="u-rol"
                    name="rol"
                    value={formulario.rol}
                    onChange={cambiarCampo}
                    disabled={editando && esUsuarioActual(editando)}
                  >
                    {Object.values(ROLES).map((rol) => (
                      <option key={rol} value={rol}>
                        {NOMBRE_ROL[rol]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* VÍNCULO SEGÚN EL ROL */}
                {formulario.rol === ROLES.ASOCIACION && (
                  <div className="gs-campo gs-campo-ancho">
                    <label htmlFor="u-asociacion">Asociación</label>
                    <select
                      id="u-asociacion"
                      name="asociacion"
                      value={formulario.asociacion}
                      onChange={cambiarCampo}
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
                    <span className="gs-ayuda">
                      Solo verá y gestionará los datos de esta asociación.
                    </span>
                  </div>
                )}

                {formulario.rol === ROLES.PRODUCTOR && (
                  <div className="gs-campo gs-campo-ancho">
                    <label htmlFor="u-productor">Productor</label>
                    <select
                      id="u-productor"
                      name="productor"
                      value={formulario.productor}
                      onChange={cambiarCampo}
                      required
                    >
                      <option value="">Seleccione el productor</option>
                      {productoresDisponibles.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.nombre} {p.apellido} · {p.cedula}
                        </option>
                      ))}
                    </select>
                    <span className="gs-ayuda">
                      Solo verá sus propios lotes. Si no aparece, primero
                      regístralo en Productores.
                    </span>
                  </div>
                )}

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
                      : "Crear usuario"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Usuarios;
