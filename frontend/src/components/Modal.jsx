import { useEffect, useRef } from "react";

import { LuX } from "react-icons/lu";


// ==========================================
// VENTANA MODAL REUTILIZABLE
// - Se cierra con la X, con la tecla Esc o al
//   hacer clic fuera (salvo si "bloqueado").
// - Recibe el foco al abrirse (accesibilidad).
// Usa las clases gs- de styles/sistema.css.
// ==========================================

const Modal = ({
  titulo,
  subtitulo,
  onCerrar,
  bloqueado = false,
  ancho = false,
  children
}) => {

  const caja = useRef(null);

  useEffect(() => {
    caja.current?.focus();

    const alPresionar = (evento) => {
      if (evento.key === "Escape" && !bloqueado) {
        onCerrar();
      }
    };

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar, bloqueado]);


  return (
    <div
      className="gs-modal-fondo"
      onClick={() => !bloqueado && onCerrar()}
    >
      <div
        ref={caja}
        tabIndex={-1}
        className={`gs-modal ${ancho ? "gs-modal-ancho" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="gs-modal-cabecera">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>

          <button
            className="gs-cerrar"
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar"
          >
            <LuX aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};

export default Modal;
