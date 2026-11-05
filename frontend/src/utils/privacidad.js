// ==========================================
// AVISO DE PRIVACIDAD: datos de configuración
// ------------------------------------------
// VERSION debe coincidir con la del backend
// (backend/utils/privacidad.js). Si se cambia el
// aviso de forma importante, se sube la versión en
// ambos archivos y todos deberán aceptarlo de nuevo.
//
// El responsable y su correo se configuran en
// frontend/.env:
//   VITE_PRIVACIDAD_RESPONSABLE=Nombre del responsable
//   VITE_PRIVACIDAD_CORREO=correo@dominio.ec
// ==========================================

export const VERSION_AVISO_PRIVACIDAD = "2026-10-25";

export const FECHA_AVISO_PRIVACIDAD = "25 de octubre de 2026";

export const RESPONSABLE_DATOS =
  import.meta.env.VITE_PRIVACIDAD_RESPONSABLE ||
  "RutaCacao, proyecto de titulación de Ingeniería en Software de la Universidad Estatal de Milagro";

// Si no se configura, la página lo indica para que no se publique sin contacto
export const CORREO_DATOS = import.meta.env.VITE_PRIVACIDAD_CORREO || "";

export const DIAS_CONSERVAR_RECHAZADAS = 180;
