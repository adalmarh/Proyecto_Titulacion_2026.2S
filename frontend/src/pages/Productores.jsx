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
import { PROVINCIAS_ECUADOR } from "../utils/formatos";

// Estilos: styles/sistema.css (importado en main.jsx)


// ==========================================
// GESTIÓN DE PRODUCTORES
// Solo el administrador: todos los productores
// pertenecen a la misma empresa.
// La ubicación de la finca se guarda aquí y se
// copia sola a cada lote nuevo del productor.
// ==========================================

const formularioVacio = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  email: "",
  provincia: "",
  canton: "",
  parroquia: "",
  referencia: ""
};

// "referencia, parroquia, cantón, provincia" para el campo dirección
const direccionDe = (f) =>
  [f.referencia, f.parroquia, f.canton, f.provincia]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");

const Productores = () => {

  const [productores, setProductores] = useState([]);

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

      const resProductores = await api.get("/productores");
      setProductores(resProductores.data || []);

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

      return coincideTexto;
    });
  }, [productores, busqueda]);


  // ========================================
  // FORMULARIO
  // ========================================

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario({ ...formularioVacio });
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
      provincia: p.ubicacion?.provincia || "",
      canton: p.ubicacion?.canton || "",
      parroquia: p.ubicacion?.parroquia || "",
      // Productores antiguos: su dirección pasa a la referencia
      referencia: p.ubicacion?.descripcion || (p.ubicacion?.canton ? "" : p.direccion || "")
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

    const { provincia, canton, parroquia, referencia, ...personales } = formulario;
    const datos = {
      ...personales,
      ubicacion: {
        provincia,
        canton: canton.trim(),
        parroquia: parroquia.trim(),
        descripcion: referencia.trim()
      },
      direccion: direccionDe(formulario)
    };

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
            Registra y administra a los productores de cacao de la empresa.
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

                <p className="gs-subtitulo-form gs-campo-ancho">
                  Ubicación de la finca
                  <span>Se copia automáticamente a cada lote nuevo de este productor.</span>
                </p>

                <div className="gs-campo">
                  <label htmlFor="p-provincia">Provincia</label>
                  <select id="p-provincia" name="provincia" value={formulario.provincia} onChange={cambiarCampo}>
                    <option value="">Seleccione</option>
                    {PROVINCIAS_ECUADOR.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="gs-campo">
                  <label htmlFor="p-canton">Cantón</label>
                  <input id="p-canton" name="canton" value={formulario.canton} onChange={cambiarCampo} maxLength={60} />
                </div>

                <div className="gs-campo">
                  <label htmlFor="p-parroquia">Parroquia o recinto</label>
                  <input id="p-parroquia" name="parroquia" value={formulario.parroquia} onChange={cambiarCampo} maxLength={60} />
                </div>

                <div className="gs-campo">
                  <label htmlFor="p-referencia">Referencia para llegar</label>
                  <input id="p-referencia" name="referencia" value={formulario.referencia} onChange={cambiarCampo} maxLength={200} placeholder="Ej.: Finca La Ceiba, km 5 vía a Naranjito" />
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
