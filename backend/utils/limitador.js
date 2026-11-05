// ==========================================
// LIMITADOR DE PETICIONES (en memoria)
// Evita que un formulario público se use para
// enviar cientos de solicitudes. Cuenta las
// peticiones por dirección IP en una ventana
// de tiempo. Se reinicia al reiniciar el servidor.
// ==========================================

const crearLimitador = ({ maximo, ventanaMs, mensaje }) => {
  const registros = new Map();

  return (req, res, next) => {
    const ahora = Date.now();
    const clave = req.ip || req.socket?.remoteAddress || "desconocida";

    const recientes = (registros.get(clave) || []).filter(
      (momento) => ahora - momento < ventanaMs
    );

    if (recientes.length >= maximo) {
      registros.set(clave, recientes);
      return res.status(429).json({ mensaje });
    }

    recientes.push(ahora);
    registros.set(clave, recientes);

    // Limpieza ocasional para no acumular IPs antiguas
    if (registros.size > 5000) {
      for (const [ip, momentos] of registros) {
        if (!momentos.some((m) => ahora - m < ventanaMs)) {
          registros.delete(ip);
        }
      }
    }

    return next();
  };
};


module.exports = crearLimitador;
