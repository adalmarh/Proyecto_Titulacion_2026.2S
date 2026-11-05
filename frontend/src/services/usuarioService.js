import api from "./api";

// ==========================================
// OBTENER CERTIFICADORES
// ==========================================
export const obtenerCertificadores =
  async () => {
    const respuesta =
      await api.get(
        "/usuarios/certificadores"
      );

    return respuesta.data;
  };