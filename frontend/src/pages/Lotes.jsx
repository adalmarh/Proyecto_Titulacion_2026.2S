import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LuPackage,
  LuPlus,
  LuPencil,
  LuPower,
  LuQrCode,
  LuSearch,
  LuCircleCheck,
  LuTriangleAlert,
  LuSprout,
  LuTractor,
  LuArchive
} from "react-icons/lu";

import api from "../services/api";
import Modal from "../components/Modal";
import ModalQR from "../components/ModalQR";
import { usePermisos } from "../utils/permisos";
import {
  NOMBRE_ESTADO_LOTE,
  UNIDADES,
  formatearFecha,
  nombreCompleto,
  idDe
} from "../utils/formatos";


// ==========================================================
// LOTES DE CACAO FINO DE AROMA
// - Administrador (la empresa): registra, edita, cambia la
//   etapa y desactiva lotes.
// - Productor: consulta sus lotes y gestiona su código QR.
// El backend devuelve solo los lotes del alcance de cada rol.
// ==========================================================

const PRODUCTO_CACAO = "Cacao fino de aroma";

const formularioVacio = {
  productor: "",
  descripcion: "",
  provincia: "",
  canton: "",
  parroquia: "",
  ubicacionDescripcion: "",
  fechaSiembra: "",
  fechaEstimadaCosecha: "",
  fechaCosecha: "",
  cantidad: "",
  unidad: "kg"
};

const fechaCampo = (valor) => (valor ? String(valor).substring(0, 10) : "");


const Lotes = () => {

  const permisos = usePermisos();

  const [lotes, setLotes] = useState([]);
  const [productores, setProductores] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroRegistro, setFiltroRegistro] = useState("activos");

  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [errorForm, setErrorForm] = useState("");

  const [loteQR, setLoteQR] = useState(null);


  // ========================================
  // CARGAR DATOS
  // ========================================

  const cargarLotes = useCallback(async () => {
    try {
      setError("");
      const respuesta = await api.get("/lotes");
      setLotes(Array.isArray(respuesta.data) ? respuesta.data : respuesta.data.lotes || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudieron cargar los lotes");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarLotes();

    // Los productores solo hacen falta para registrar o editar
    if (permisos.gestionarLotes) {
      api.get("/productores").then((r) => setProductores(r.data || [])).catch(() => {});
    }
  }, [cargarLotes, permisos.gestionarLotes]);


  // ========================================
  // FILTROS
  // ========================================

  const lotesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lotes.filter((lote) => {
      const coincideTexto =
        !texto ||
        `${lote.codigo} ${lote.descripcion || ""} ${nombreCompleto(lote.productor)}`
          .toLowerCase()
          .includes(texto);

      const coincideEtapa = !filtroEtapa || lote.estado === filtroEtapa;

      const activo = lote.activo !== false;
      const coincideRegistro =
        filtroRegistro === "todos" ||
        (filtroRegistro === "activos" ? activo : !activo);

      return coincideTexto && coincideEtapa && coincideRegistro;
    });
  }, [lotes, busqueda, filtroEtapa, filtroRegistro]);

  const totalActivos = lotes.filter((l) => l.activo !== false).length;
  const productoresConLotes = new Set(lotes.map((l) => idDe(l.productor))).size;
  const cosechados = lotes.filter(
    (l) => l.activo !== false && ["cosechado", "almacenado", "transportado", "distribuido", "finalizado"].includes(l.estado)
  ).length;


  // ========================================
  // FORMULARIO
  // ========================================

  const productoresActivos = productores.filter((p) => p.activo !== false);

  // ---------- Ubicación automática al elegir el productor ----------
  // Se toma de la ficha del productor o, si no la tiene, de su
  // lote más reciente. Solo se reemplazan los campos vacíos o los
  // que se habían llenado solos (no lo que la persona escribió).
  const [autollenado, setAutollenado] = useState(null); // { valores, origen }

  const ubicacionDelProductor = (productorId) => {
    const p = productores.find((x) => x._id === productorId);
    const u = p?.ubicacion;
    if (u && (u.canton || u.parroquia || u.provincia)) {
      return { valores: u, origen: "la ficha del productor" };
    }
    const ultimo = lotes
      .filter((l) => idDe(l.productor) === productorId && (l.ubicacion?.canton || l.ubicacion?.provincia))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    return ultimo ? { valores: ultimo.ubicacion, origen: `su lote ${ultimo.codigo}` } : null;
  };

  const CAMPOS_UBICACION = [
    ["provincia", "provincia"],
    ["canton", "canton"],
    ["parroquia", "parroquia"],
    ["ubicacionDescripcion", "descripcion"]
  ];

  const elegirProductor = (productorId) => {
    const encontrada = ubicacionDelProductor(productorId);

    setFormulario((anterior) => {
      const nuevo = { ...anterior, productor: productorId };
      CAMPOS_UBICACION.forEach(([campo, origen]) => {
        const actual = (anterior[campo] || "").trim();
        const puesto = (autollenado?.valores?.[origen] || "").trim();
        if (!actual || actual === puesto) {
          nuevo[campo] = encontrada?.valores?.[origen] || "";
        }
      });
      return nuevo;
    });

    setAutollenado(encontrada);
  };

  const abrirNuevo = () => {
    setEditando(null);
    setAutollenado(null);
    setFormulario({ ...formularioVacio });
    setErrorForm("");
    setMensaje("");
    setFormAbierto(true);
  };

  const abrirEdicion = (lote) => {
    const u = lote.ubicacion || {};
    setEditando(lote);
    setAutollenado(null);
    setFormulario({
      productor: idDe(lote.productor),
      descripcion: lote.descripcion || "",
      provincia: u.provincia || "",
      canton: u.canton || "",
      parroquia: u.parroquia || "",
      ubicacionDescripcion: u.descripcion || "",
      fechaSiembra: fechaCampo(lote.fechaSiembra),
      fechaEstimadaCosecha: fechaCampo(lote.fechaEstimadaCosecha),
      fechaCosecha: fechaCampo(lote.fechaCosecha),
      cantidad: lote.cantidad ?? "",
      unidad: lote.unidad || "kg"
    });
    setErrorForm("");
    setMensaje("");
    setFormAbierto(true);
  };

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;
    if (name === "productor" && !editando) {
      elegirProductor(value);
      return;
    }
    setFormulario((anterior) => ({
      ...anterior,
      [name]: value
    }));
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setErrorForm("");

    if (!formulario.productor || formulario.cantidad === "") {
      setErrorForm("Completa el productor y la cantidad.");
      return;
    }

    const datos = {
      producto: PRODUCTO_CACAO,
      descripcion: formulario.descripcion,
      ubicacion: {
        provincia: formulario.provincia,
        canton: formulario.canton,
        parroquia: formulario.parroquia,
        descripcion: formulario.ubicacionDescripcion
      },
      fechaSiembra: formulario.fechaSiembra || undefined,
      fechaEstimadaCosecha: formulario.fechaEstimadaCosecha || undefined,
      cantidad: Number(formulario.cantidad),
      unidad: formulario.unidad
    };

    try {
      setGuardando(true);

      if (editando) {
        datos.fechaCosecha = formulario.fechaCosecha || undefined;
        await api.put(`/lotes/${editando._id}`, datos);
        setMensaje(`Lote ${editando.codigo} actualizado correctamente`);
      } else {
        // el productor solo se envía al crear
        datos.productor = formulario.productor;
        const respuesta = await api.post("/lotes", datos);
        setMensaje(
          `Lote ${respuesta.data.lote?.codigo || ""} registrado correctamente`
        );
      }

      setFormAbierto(false);
      await cargarLotes();

    } catch (err) {
      setErrorForm(err.response?.data?.mensaje || "No se pudo guardar el lote");
    } finally {
      setGuardando(false);
    }
  };


  // ========================================
  // ETAPA Y DESACTIVACIÓN
  // ========================================

  const cambiarEtapa = async (lote, estado) => {
    try {
      setError("");
      await api.patch(`/lotes/${lote._id}/estado`, { estado });
      setMensaje(`Lote ${lote.codigo}: etapa actualizada a «${NOMBRE_ESTADO_LOTE[estado]}»`);
      await cargarLotes();
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo actualizar la etapa");
    }
  };

  const desactivar = async (lote) => {
    if (!window.confirm(
      `¿Desactivar el lote ${lote.codigo}? Su historial se conserva, pero dejará de aparecer entre los lotes activos.`
    )) {
      return;
    }

    try {
      setError("");
      await api.patch(`/lotes/${lote._id}/desactivar`);
      setMensaje(`Lote ${lote.codigo} desactivado`);
      await cargarLotes();
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo desactivar el lote");
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
            <LuPackage aria-hidden="true" />
            {permisos.gestionarLotes ? "Lotes de cacao" : "Mis lotes de cacao"}
          </h1>
          <p>
            {permisos.gestionarLotes
              ? "Registra los lotes de cacao fino de aroma y actualiza su etapa."
              : "Consulta tus lotes y el código QR de cada uno."}
          </p>
        </div>

        {permisos.gestionarLotes && (
          <button className="gs-btn gs-btn-principal" onClick={abrirNuevo}>
            <LuPlus aria-hidden="true" />
            Nuevo lote
          </button>
        )}
      </div>


      {mensaje && (
        <div className="gs-alerta gs-alerta-exito">
          <LuCircleCheck aria-hidden="true" />
          {mensaje}
        </div>
      )}

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
            <span>Lotes registrados</span>
          </div>
        </div>
        <div className="gs-kpi kpi-verde">
          <span className="gs-kpi-icono"><LuSprout aria-hidden="true" /></span>
          <div>
            <strong>{totalActivos}</strong>
            <span>Lotes activos</span>
          </div>
        </div>
        <div className="gs-kpi kpi-ambar">
          <span className="gs-kpi-icono"><LuArchive aria-hidden="true" /></span>
          <div>
            <strong>{cosechados}</strong>
            <span>Cosechados o en poscosecha</span>
          </div>
        </div>
        <div className="gs-kpi kpi-morado">
          <span className="gs-kpi-icono"><LuTractor aria-hidden="true" /></span>
          <div>
            <strong>{productoresConLotes}</strong>
            <span>Productores con lotes</span>
          </div>
        </div>
      </section>


      {/* FILTROS */}
      <div className="gs-filtros">
        <div className="gs-buscador">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por código, productor o descripción"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar lotes"
          />
        </div>

        <select
          value={filtroEtapa}
          onChange={(e) => setFiltroEtapa(e.target.value)}
          aria-label="Filtrar por etapa"
        >
          <option value="">Todas las etapas</option>
          {Object.entries(NOMBRE_ESTADO_LOTE).map(([valor, nombre]) => (
            <option key={valor} value={valor}>{nombre}</option>
          ))}
        </select>

        <select
          value={filtroRegistro}
          onChange={(e) => setFiltroRegistro(e.target.value)}
          aria-label="Filtrar por estado del registro"
        >
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo desactivados</option>
          <option value="todos">Activos y desactivados</option>
        </select>
      </div>


      {/* TABLA */}
      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando lotes...</div>
        ) : lotesFiltrados.length === 0 ? (
          <div className="gs-vacio">
            <LuPackage aria-hidden="true" />
            <h3>
              {lotes.length === 0 ? "Todavía no hay lotes" : "Ningún lote coincide con los filtros"}
            </h3>
            <p>
              {lotes.length > 0
                ? "Cambia la búsqueda o los filtros."
                : permisos.gestionarLotes
                  ? "Registra el primero con el botón «Nuevo lote»."
                  : "La empresa es quien registra los lotes."}
            </p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Productor</th>
                  <th>Cantidad</th>
                  <th>Etapa</th>
                  <th>Cosecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {lotesFiltrados.map((lote) => {
                  const activo = lote.activo !== false;

                  return (
                    <tr key={lote._id} className={activo ? "" : "gs-fila-inactiva"}>
                      <td>
                        <span className="gs-codigo">{lote.codigo}</span>
                        <span className="gs-secundario">
                          {lote.descripcion || lote.producto}
                          {!activo && " · Desactivado"}
                        </span>
                      </td>

                      <td>
                        <span className="gs-principal">{nombreCompleto(lote.productor)}</span>
                      </td>

                      <td style={{ whiteSpace: "nowrap" }}>
                        {Number(lote.cantidad).toLocaleString("es-EC")} {lote.unidad || "kg"}
                      </td>

                      <td>
                        {permisos.gestionarLotes && activo ? (
                          <select
                            className="gs-select-tabla"
                            value={lote.estado || "activo"}
                            onChange={(e) => cambiarEtapa(lote, e.target.value)}
                            aria-label={`Etapa del lote ${lote.codigo}`}
                          >
                            {Object.entries(NOMBRE_ESTADO_LOTE).map(([valor, nombre]) => (
                              <option key={valor} value={valor}>{nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`gs-estado gs-estado-${lote.estado}`}>
                            {NOMBRE_ESTADO_LOTE[lote.estado] || lote.estado}
                          </span>
                        )}
                      </td>

                      <td style={{ whiteSpace: "nowrap" }}>
                        {lote.fechaCosecha ? (
                          formatearFecha(lote.fechaCosecha)
                        ) : (
                          <>
                            {formatearFecha(lote.fechaEstimadaCosecha)}
                            {lote.fechaEstimadaCosecha && (
                              <span className="gs-secundario">estimada</span>
                            )}
                          </>
                        )}
                      </td>

                      <td>
                        <div className="gs-acciones">
                          {permisos.gestionarLotes && activo && (
                            <button
                              className="gs-btn gs-btn-icono"
                              onClick={() => abrirEdicion(lote)}
                            >
                              <LuPencil aria-hidden="true" />
                              Editar
                            </button>
                          )}

                          {activo && (
                            <button
                              className="gs-btn gs-btn-icono"
                              onClick={() => setLoteQR(lote)}
                            >
                              <LuQrCode aria-hidden="true" />
                              QR
                            </button>
                          )}

                          {permisos.gestionarLotes && activo && (
                            <button
                              className="gs-btn gs-btn-peligro"
                              onClick={() => desactivar(lote)}
                            >
                              <LuPower aria-hidden="true" />
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* FORMULARIO REGISTRAR / EDITAR */}
      {formAbierto && (
        <Modal
          titulo={editando ? `Editar lote ${editando.codigo}` : "Nuevo lote de cacao"}
          subtitulo={
            editando
              ? "El productor no se puede cambiar."
              : "El código del lote se genera automáticamente."
          }
          onCerrar={() => setFormAbierto(false)}
          bloqueado={guardando}
          ancho
        >
          <form className="gs-formulario" onSubmit={guardar}>

            {errorForm && (
              <div className="gs-alerta gs-alerta-error">
                <LuTriangleAlert aria-hidden="true" />
                {errorForm}
              </div>
            )}

            <div className="gs-campos">

              <div className="gs-campo">
                <label htmlFor="l-productor">Productor *</label>
                <select
                  id="l-productor"
                  name="productor"
                  value={formulario.productor}
                  onChange={cambiarCampo}
                  disabled={Boolean(editando)}
                  required
                >
                  <option value="">Seleccione el productor</option>
                  {(editando ? productores : productoresActivos).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.nombre} {p.apellido}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gs-campo">
                <label htmlFor="l-cantidad">Cantidad *</label>
                <input
                  id="l-cantidad"
                  name="cantidad"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.cantidad}
                  onChange={cambiarCampo}
                  required
                />
              </div>

              <div className="gs-campo">
                <label htmlFor="l-unidad">Unidad</label>
                <select id="l-unidad" name="unidad" value={formulario.unidad} onChange={cambiarCampo}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="gs-campo">
                <label htmlFor="l-siembra">Fecha de siembra</label>
                <input id="l-siembra" type="date" name="fechaSiembra" value={formulario.fechaSiembra} onChange={cambiarCampo} />
              </div>

              <div className="gs-campo">
                <label htmlFor="l-estimada">Cosecha estimada</label>
                <input id="l-estimada" type="date" name="fechaEstimadaCosecha" value={formulario.fechaEstimadaCosecha} onChange={cambiarCampo} />
              </div>

              {editando && (
                <div className="gs-campo">
                  <label htmlFor="l-cosecha">Fecha real de cosecha</label>
                  <input id="l-cosecha" type="date" name="fechaCosecha" value={formulario.fechaCosecha} onChange={cambiarCampo} />
                </div>
              )}

              {!editando && formulario.productor && (
                <p className={`gs-campo-ancho lt-autollenado${autollenado ? "" : " lt-autollenado-vacio"}`}>
                  {autollenado
                    ? `Ubicación copiada de ${autollenado.origen}. Puedes cambiarla si este lote está en otra parcela.`
                    : "Este productor aún no tiene ubicación guardada: escríbela aquí o complétala en Productores."}
                </p>
              )}

              <div className="gs-campo">
                <label htmlFor="l-provincia">Provincia</label>
                <input id="l-provincia" name="provincia" value={formulario.provincia} onChange={cambiarCampo} />
              </div>

              <div className="gs-campo">
                <label htmlFor="l-canton">Cantón</label>
                <input id="l-canton" name="canton" value={formulario.canton} onChange={cambiarCampo} />
              </div>

              <div className="gs-campo">
                <label htmlFor="l-parroquia">Parroquia</label>
                <input id="l-parroquia" name="parroquia" value={formulario.parroquia} onChange={cambiarCampo} />
              </div>

              <div className="gs-campo gs-campo-ancho">
                <label htmlFor="l-referencia">Referencia de la parcela</label>
                <input
                  id="l-referencia"
                  name="ubicacionDescripcion"
                  value={formulario.ubicacionDescripcion}
                  onChange={cambiarCampo}
                  placeholder="Ej.: Finca La Esperanza, junto al río"
                />
              </div>

              <div className="gs-campo gs-campo-ancho">
                <label htmlFor="l-descripcion">Descripción</label>
                <textarea
                  id="l-descripcion"
                  name="descripcion"
                  rows={3}
                  value={formulario.descripcion}
                  onChange={cambiarCampo}
                  placeholder="Variedad, manejo, observaciones…"
                />
              </div>

            </div>

            <div className="gs-botones-modal">
              <button
                type="button"
                className="gs-btn gs-btn-secundario"
                onClick={() => setFormAbierto(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button type="submit" className="gs-btn gs-btn-principal" disabled={guardando}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar lote"}
              </button>
            </div>
          </form>
        </Modal>
      )}


      {/* CÓDIGO QR DEL LOTE */}
      {loteQR && (
        <ModalQR lote={loteQR} onCerrar={() => setLoteQR(null)} />
      )}

    </div>
  );
};

export default Lotes;
