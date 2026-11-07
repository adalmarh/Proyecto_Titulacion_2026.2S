// ==========================================
// LÍMITE DE INTENTOS AL INICIAR SESIÓN (en memoria)
// ------------------------------------------
// Evita que alguien pruebe contraseñas una tras
// otra (ataque de fuerza bruta):
//
//   - Por cuenta: 5 intentos fallidos con el mismo
//     correo desde la misma red en 15 minutos
//     bloquean ese correo en esa red 15 minutos.
//   - Por red: 20 intentos fallidos desde la misma
//     dirección IP (con cualquier correo) bloquean
//     esa red 15 minutos.
//
// Un inicio de sesión correcto borra los fallos de
// esa cuenta. El bloqueo es por red y no de la cuenta
// entera, para que un atacante no pueda dejar fuera
// al dueño de la cuenta desde otra red.
//
// Se configura en el .env (opcional):
//   LOGIN_MAX_INTENTOS=5
//   LOGIN_MAX_INTENTOS_RED=20
//   LOGIN_BLOQUEO_MINUTOS=15
// Los contadores se reinician al reiniciar el servidor.
// ==========================================

const crearControlIntentos = ({
  maximoPorCuenta = 5,
  maximoPorRed = 20,
  ventanaMs = 15 * 60 * 1000,
  bloqueoMs = 15 * 60 * 1000,
  reloj = () => Date.now()
} = {}) => {
  // clave -> { fallos: [momentos], bloqueadoHasta }
  const registros = new Map();

  const claves = (ip, email) => {
    const red = String(ip || "desconocida");
    const correo = String(email || "").trim().toLowerCase();
    return { cuenta: `${red}|${correo}`, red: `red|${red}` };
  };

  const leer = (clave, ahora) => {
    const r = registros.get(clave) || { fallos: [], bloqueadoHasta: 0 };
    r.fallos = r.fallos.filter((m) => ahora - m < ventanaMs);
    return r;
  };

  const minutos = (hasta, ahora) => Math.max(1, Math.ceil((hasta - ahora) / 60000));

  const limpiar = (ahora) => {
    if (registros.size <= 5000) return;
    for (const [clave, r] of registros) {
      if (r.bloqueadoHasta <= ahora && !r.fallos.some((m) => ahora - m < ventanaMs)) {
        registros.delete(clave);
      }
    }
  };

  // ¿Está bloqueado antes de revisar la contraseña?
  const revisar = (ip, email) => {
    const ahora = reloj();
    const { cuenta, red } = claves(ip, email);
    const hasta = Math.max(leer(cuenta, ahora).bloqueadoHasta, leer(red, ahora).bloqueadoHasta);
    return hasta > ahora
      ? { bloqueado: true, minutos: minutos(hasta, ahora) }
      : { bloqueado: false };
  };

  // Registrar un intento fallido
  const fallo = (ip, email) => {
    const ahora = reloj();
    const { cuenta, red } = claves(ip, email);

    const rc = leer(cuenta, ahora);
    const rr = leer(red, ahora);
    rc.fallos.push(ahora);
    rr.fallos.push(ahora);

    if (rc.fallos.length >= maximoPorCuenta) {
      rc.bloqueadoHasta = ahora + bloqueoMs;
      rc.fallos = [];
    }
    if (rr.fallos.length >= maximoPorRed) {
      rr.bloqueadoHasta = ahora + bloqueoMs;
      rr.fallos = [];
    }

    registros.set(cuenta, rc);
    registros.set(red, rr);
    limpiar(ahora);

    const hasta = Math.max(rc.bloqueadoHasta, rr.bloqueadoHasta);
    if (hasta > ahora) {
      return { bloqueado: true, minutos: minutos(hasta, ahora) };
    }

    return {
      bloqueado: false,
      restantes: Math.min(maximoPorCuenta - rc.fallos.length, maximoPorRed - rr.fallos.length)
    };
  };

  // Inicio de sesión correcto: se olvidan los fallos de esa cuenta
  const exito = (ip, email) => {
    registros.delete(claves(ip, email).cuenta);
  };

  return { revisar, fallo, exito };
};


// Control que usa el inicio de sesión (configurable en el .env)
const numero = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

const intentosLogin = crearControlIntentos({
  maximoPorCuenta: numero(process.env.LOGIN_MAX_INTENTOS, 5),
  maximoPorRed: numero(process.env.LOGIN_MAX_INTENTOS_RED, 20),
  bloqueoMs: numero(process.env.LOGIN_BLOQUEO_MINUTOS, 15) * 60 * 1000
});


module.exports = { crearControlIntentos, intentosLogin };
