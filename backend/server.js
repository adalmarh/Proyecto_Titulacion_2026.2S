const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();


// ==========================================
// CONEXIÓN A MONGODB
// ==========================================

const connectDB = require(
  "./config/db"
);


// ==========================================
// RUTAS
// ==========================================

const authRoutes = require(
  "./routes/authRoutes"
);

const productorRoutes = require(
  "./routes/productorRoutes"
);

const loteRoutes = require(
  "./routes/loteRoutes"
);

const trazabilidadRoutes = require(
  "./routes/trazabilidadRoutes"
);

const certificacionRoutes = require(
  "./routes/certificacionRoutes"
);

const qrRoutes = require(
  "./routes/qrRoutes"
);

const publicRoutes = require(
  "./routes/publicRoutes"
);

const estadisticasRoutes = require(
  "./routes/estadisticasRoutes"
);

const usuarioRoutes = require(
  "./routes/usuarioRoutes"
);

const solicitudRoutes = require(
  "./routes/solicitudRoutes"
);


// ==========================================
// CONECTAR BASE DE DATOS
// ==========================================

connectDB();


// ==========================================
// CREAR APLICACIÓN
// ==========================================

const app = express();

// Si el servidor está detrás de un proxy (por ejemplo, al
// publicarlo en internet), TRUST_PROXY=1 hace que req.ip sea
// la IP real del visitante. Lo usan el límite de intentos del
// inicio de sesión y el de solicitudes de cuenta.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}


// ==========================================
// MIDDLEWARES
// ==========================================

app.use(
  cors()
);

app.use(
  express.json()
);


// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      mensaje:
        "API del Sistema Web de Trazabilidad y Certificación de Lotes Agrícolas funcionando correctamente"
    });
  }
);


// ==========================================
// RUTAS DE LA API
// ==========================================

// AUTENTICACIÓN
app.use(
  "/api/auth",
  authRoutes
);



// PRODUCTORES
app.use(
  "/api/productores",
  productorRoutes
);


// LOTES
app.use(
  "/api/lotes",
  loteRoutes
);


// TRAZABILIDAD
app.use(
  "/api/trazabilidad",
  trazabilidadRoutes
);


// CERTIFICACIONES
app.use(
  "/api/certificaciones",
  certificacionRoutes
);


// CÓDIGOS QR
app.use(
  "/api/qr",
  qrRoutes
);


// CONSULTA PÚBLICA
app.use(
  "/api/public",
  publicRoutes
);


// ESTADÍSTICAS
app.use(
  "/api/estadisticas",
  estadisticasRoutes
);


// USUARIOS / CERTIFICADORES
app.use(
  "/api/usuarios",
  usuarioRoutes
);


// SOLICITUDES DE CUENTA (revisión)
app.use(
  "/api/solicitudes",
  solicitudRoutes
);


// ==========================================
// RUTA NO ENCONTRADA
// ==========================================

app.use(
  (req, res) => {
    res.status(404).json({
      mensaje:
        `Ruta no encontrada: ${req.originalUrl}`
    });
  }
);


// ==========================================
// MANEJO DE ERRORES
// ==========================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Error del servidor:",
      err
    );

    return res.status(
      err.status || 500
    ).json({
      mensaje:
        err.message ||
        "Error interno del servidor"
    });
  }
);


// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT =
  process.env.PORT || 5000;

// ==========================================
// LIMPIEZA DIARIA DE SOLICITUDES RECHAZADAS
// ==========================================

const { limpiarSolicitudesRechazadas } = require(
  "./controllers/solicitudController"
);

const limpiar = () =>
  limpiarSolicitudesRechazadas()
    .then((n) => n && console.log(`Solicitudes rechazadas eliminadas: ${n}`))
    .catch((error) => console.error("Error en la limpieza de solicitudes:", error.message));

setTimeout(limpiar, 10 * 1000);
setInterval(limpiar, 24 * 60 * 60 * 1000).unref();


// ==========================================
// CERTIFICACIONES VENCIDAS
// Las aprobadas cuya fecha de vencimiento ya
// pasó se marcan como "vencidas" al arrancar
// y luego cada hora.
// ==========================================

const { marcarCertificacionesVencidas } = require("./utils/vencimientos");

const revisarVencimientos = () =>
  marcarCertificacionesVencidas()
    .then((n) => n && console.log(`Certificaciones marcadas como vencidas: ${n}`))
    .catch((error) => console.error("Error al revisar vencimientos:", error.message));

setTimeout(revisarVencimientos, 5 * 1000);
setInterval(revisarVencimientos, 60 * 60 * 1000).unref();


app.listen(
  PORT,
  () => {
    console.log(
      `Servidor ejecutándose en el puerto ${PORT}`
    );

    console.log(
      `URL local: http://localhost:${PORT}`
    );
  }
);