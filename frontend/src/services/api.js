import axios from "axios";

// ==========================================
// DIRECCIÓN DE LA API
// Por defecto se usa el mismo equipo desde el
// que se abrió la página, en el puerto 5000.
// Así funciona tanto en la computadora
// (localhost) como en un celular que abre la
// página con la IP de la computadora, por
// ejemplo al escanear un QR.
// Se puede fijar otra dirección con la variable
// VITE_API_URL en el archivo frontend/.env
// ==========================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({
  baseURL: API_URL
});


// ==========================================
// ENVIAR EL TOKEN EN CADA PETICIÓN
// ==========================================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


// ==========================================
// SESIÓN EXPIRADA O USUARIO DESACTIVADO
// Si el backend rechaza el token (401) o la
// cuenta fue desactivada, se avisa a
// AuthContext para que cierre la sesión.
// ==========================================

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const estado = error.response?.status;
    const mensaje = error.response?.data?.mensaje;
    const habiaSesion = Boolean(localStorage.getItem("token"));
    const esLogin = error.config?.url?.includes("/auth/login");

    if (
      habiaSesion &&
      !esLogin &&
      (estado === 401 || mensaje === "Usuario desactivado")
    ) {
      window.dispatchEvent(
        new CustomEvent("sesion-expirada", {
          detail: mensaje || "Tu sesión ha expirado"
        })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
