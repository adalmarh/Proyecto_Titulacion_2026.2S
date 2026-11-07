# RutaCacao — Cambios del 7 de noviembre de 2026

Sistema web para la trazabilidad y certificación de lotes de cacao fino de aroma mediante códigos QR dinámicos.

Este documento resume las mejoras hechas el **sábado 7 de noviembre de 2026**: qué cambió, qué archivos se tocaron, cómo aplicarlas y cómo comprobarlas.

| N.º | Mejora | Parte del sistema |
|---|---|---|
| 1 | Foto del cacaotal como fondo del inicio de sesión | Frontend |
| 2 | Foto del cacaotal en «Solicitar acceso» y en la consulta pública del QR | Frontend |
| 3 | Límite de intentos al iniciar sesión | Backend |
| 4 | Certificaciones vencidas automáticamente y aviso 30 días antes | Backend y frontend |
| 5 | Cantidad del lote siempre en kg (se puede escribir en quintales) y estado del grano | Backend y frontend |

---

## 1. Foto del cacaotal en el inicio de sesión

**Qué cambió**

- La página de inicio de sesión tiene de fondo la foto de un cacaotal con mazorcas.
- El texto de la izquierda lleva un degradado color cacao para que se lea bien sobre la foto. El formulario va en una tarjeta blanca con sombra.
- En el celular el texto queda arriba y la tarjeta abajo, sin desplazamiento lateral.
- La imagen se guardó como JPG optimizado: 87 KB en lugar de 526 KB.

**Archivos**

| Archivo | Cambio |
|---|---|
| `frontend/src/assets/fondo-login.jpg` | **Nuevo.** Foto del cacaotal |
| `frontend/src/pages/Login.jsx` | Usa la foto de fondo |
| `frontend/src/index.css` | Estilos `.login-con-fondo` |

**Pendiente**

- La foto mide 600 × 399 píxeles y en pantallas grandes se ve un poco suave. Para que se vea nítida, reemplaza `fondo-login.jpg` por la misma foto con 1920 píxeles de ancho o más, con el mismo nombre.
- Revisa que tengas derecho a usar la foto; si no es tuya, pon el crédito del autor o usa una propia.

---

## 2. Foto del cacaotal en las páginas públicas

**Qué cambió**

- **Solicitar acceso:** usa el mismo diseño que el inicio de sesión (foto de fondo y formulario en una tarjeta), para que las dos páginas se vean como una sola entrada al sistema.
- **Consulta pública del QR:** la foto va solo en la franja de arriba, detrás del sello del lote, cubierta con el color cacao. El resto de la página conserva el fondo claro.
- Las páginas internas (Dashboard, Lotes, Certificaciones, etc.) siguen con fondo liso, para que se lean bien al trabajar.

**Archivos**

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/SolicitarCuenta.jsx` | Usa la foto de fondo |
| `frontend/src/pages/ConsultaPublicaQR.jsx` | Franja con la foto en la cabecera |
| `frontend/src/pages/ConsultaPublicaQR.css` | Estilo `.cp-cabecera-foto` |

---

## 3. Límite de intentos al iniciar sesión

**Qué cambió**

- Si la contraseña es incorrecta, el mensaje es «Correo o contraseña incorrectos». Cuando quedan 2 intentos o menos, avisa cuántos quedan.
- **5 intentos fallidos con el mismo correo en 15 minutos** bloquean ese correo **desde esa red** por **15 minutos**, aunque luego se escriba la contraseña correcta.
- **20 intentos fallidos desde una misma red** (con cualquier correo) bloquean esa red 15 minutos.
- El bloqueo es por red y no de toda la cuenta: un atacante no puede dejar fuera al dueño de la cuenta, que sigue entrando desde su propia red.
- Un inicio de sesión correcto borra los fallos de esa cuenta.
- El detalle técnico de los errores del inicio de sesión ya no se envía al navegador; solo aparece en la consola del backend.
- Se agregó la opción `TRUST_PROXY`, necesaria cuando el sistema esté publicado detrás de un proxy.

**Configuración opcional (`backend/.env`)**

```
LOGIN_MAX_INTENTOS=5
LOGIN_MAX_INTENTOS_RED=20
LOGIN_BLOQUEO_MINUTOS=15
TRUST_PROXY=1        # solo cuando esté publicado detrás de un proxy
```

Los contadores se guardan en memoria: si alguien queda bloqueado durante las pruebas, basta con reiniciar el backend.

**Archivos**

| Archivo | Cambio |
|---|---|
| `backend/utils/intentosLogin.js` | **Nuevo.** Control de intentos por cuenta y por red |
| `backend/controllers/authController.js` | El inicio de sesión usa el control de intentos |
| `backend/server.js` | Opción `TRUST_PROXY` |
| `backend/pruebas/intentosLogin.test.js` | **Nuevo.** 8 pruebas unitarias |
| `backend/pruebas/integracion.js` | Casos LI01–LI04 |

---

## 4. Vencimiento de certificaciones

**Qué cambió**

- Una certificación aprobada cuya fecha de vencimiento ya pasó cambia sola a **«Vencida»**. El backend lo revisa al arrancar, cada hora y cada vez que se abren las certificaciones o el dashboard.
- Al aprobar una certificación, la fecha de vencimiento debe ser posterior a hoy. El calendario empieza en mañana y el backend rechaza fechas pasadas.
- **Avisos en los paneles:**
  - **Administrador (Dashboard) y certificador (su panel):** aviso amarillo con las certificaciones que vencen en los próximos 30 días (código, lote, productor y días que faltan), y aviso rojo con las que vencieron en los últimos 30 días. El certificador solo ve las suyas.
  - **Productor (su panel):** el mismo aviso con sus certificaciones y la sugerencia de solicitar la renovación.
- **Lista de certificaciones:** etiqueta «Vence en N días» en las que están por vencer; las vencidas dicen «Venció: [fecha]».
- Nueva ruta `GET /api/certificaciones/avisos/vencimientos`, que devuelve solo lo que cada rol puede ver, sin cédulas ni correos.
- Los avisos aparecen dentro del sistema. No se envían correos, porque el sistema aún no tiene un servicio de correo configurado.

**Archivos**

| Archivo | Cambio |
|---|---|
| `backend/utils/vencimientos.js` | **Nuevo.** Marca las vencidas y calcula los días que faltan |
| `backend/controllers/certificacionController.js` | Valida la fecha al aprobar; ruta de avisos |
| `backend/controllers/estadisticasController.js` | Cuenta las que están por vencer |
| `backend/routes/certificacionRoutes.js` | Ruta `/avisos/vencimientos` |
| `backend/server.js` | Revisión de vencimientos al arrancar y cada hora |
| `backend/pruebas/vencimientos.test.js` | **Nuevo.** 5 pruebas unitarias |
| `backend/pruebas/alcance.test.js` | Ajuste de la base simulada |
| `backend/pruebas/integracion.js` | Casos V01–V03 |
| `frontend/src/components/AvisoVencimientos.jsx` | **Nuevo.** Aviso de los paneles |
| `frontend/src/components/ModalDictamen.jsx` | El calendario empieza en mañana |
| `frontend/src/pages/Dashboard.jsx` | Muestra el aviso |
| `frontend/src/pages/PanelCertificador.jsx` | Muestra el aviso |
| `frontend/src/pages/PanelProductor.jsx` | Muestra el aviso |
| `frontend/src/pages/Certificaciones.jsx` | Etiqueta «Vence en N días» |
| `frontend/src/utils/formatos.js` | Función `diasParaVencer` |
| `frontend/src/styles/sistema.css` | Estilos `.av-*` |

---

## 5. Cantidad del lote en kg y estado del grano

**Qué cambió**

- La cantidad se guarda **siempre en kilogramos**, para que todos los lotes se puedan comparar y sumar.
- En el formulario se puede escribir en **kilogramos o quintales**; se quitaron los gramos y las toneladas. La conversión la hace el backend: **1 quintal = 100 libras = 45,3592 kg**.
- Debajo de la cantidad, una ayuda muestra la equivalencia: «Se guardará como 907,18 kg» o «Equivale a ≈ 26,5 quintales».
- Nuevo campo **Estado del grano**: «Seco (fermentado y secado)» o «En baba (fresco)». Por defecto es seco.
- Ya no se aceptan cantidades de cero ni negativas.
- **Cómo se muestra la cantidad:**
  - en la lista de lotes, la trazabilidad, los paneles, la consulta pública y la verificación: «1.200 kg (≈ 26,5 qq) · seco»;
  - en el certificado PDF: «1.200 kg (26,5 qq aprox.) de cacao seco».

**Archivos**

| Archivo | Cambio |
|---|---|
| `backend/utils/cantidades.js` | **Nuevo.** Conversión a kg y validación del grano |
| `backend/models/Lote.js` | Campo `estadoGrano` |
| `backend/controllers/loteController.js` | Convierte a kg al crear y editar |
| `backend/controllers/certificacionController.js` | Incluye el estado del grano |
| `backend/utils/respuestaPublica.js` | Incluye el estado del grano |
| `backend/utils/generarCertificadoPDF.js` | Cantidad en kg, quintales y grano |
| `backend/scripts/convertirCantidadesLotes.js` | **Nuevo.** Convierte a kg los lotes antiguos |
| `backend/pruebas/cantidades.test.js` | **Nuevo.** 6 pruebas unitarias |
| `backend/pruebas/integracion.js` | Casos L12–L13 |
| `frontend/src/pages/Lotes.jsx` | Unidad kg/quintales, ayuda de conversión, estado del grano |
| `frontend/src/utils/formatos.js` | `formatearCantidad`, `UNIDADES_ENTRADA`, `ESTADOS_GRANO` |
| `frontend/src/pages/` (Trazabilidad, Dashboard, paneles, consulta pública, verificación) | Muestran la cantidad con el nuevo formato |

---

## Cómo aplicar los cambios

1. Descomprime cada ZIP sobre la carpeta del proyecto, en este orden:
   `fondo-login.zip`, `fondo-paginas-publicas.zip`, `limite-intentos.zip`, `vencimientos.zip` y `cantidad-kg-quintales.zip`.

   ```powershell
   Expand-Archive .\<archivo>.zip -DestinationPath C:\Users\FAMILY\Desktop\trazabilidad-agricola -Force
   ```

2. Convierte a kg los lotes antiguos. Primero revisa la lista (no cambia nada):

   ```powershell
   cd C:\Users\FAMILY\Desktop\trazabilidad-agricola\backend
   npm run convertir-cantidades
   ```

   Si la lista es correcta, aplícalo:

   ```powershell
   npm run convertir-cantidades -- --confirmar
   ```

   Este paso también marca como «seco» los lotes que aún no tienen estado del grano. Si alguno era en baba, cámbialo en Lotes → Editar.

3. Reinicia el backend y el frontend (`npm run dev` en cada carpeta).

---

## Pruebas

| Nivel | Antes de hoy | Hoy | Cómo ejecutarlas |
|---|---|---|---|
| Unitarias | 48 | **67** (todas aprobadas) | `npm test` en `backend` |
| Integración de la API | 110 | **119** | `npm run test:integracion` en `backend` (necesita MongoDB) |
| Pruebas manuales | — | Secciones 11, 12 y 13 de `pruebas_roles.md` | Seguir cada tabla |

Las pruebas unitarias y las de interfaz se comprobaron en el entorno de desarrollo. Las de integración y los scripts que modifican la base de datos deben ejecutarse en tu computadora, porque necesitan MongoDB.

---

## Comandos nuevos

| Comando (en `backend`) | Para qué sirve |
|---|---|
| `npm run convertir-cantidades` | Muestra qué lotes se convertirían a kg (no cambia nada) |
| `npm run convertir-cantidades -- --confirmar` | Convierte los lotes y marca el grano como seco |

---

## Lo que sigue

- Publicar el sistema en internet para que el QR funcione desde cualquier lugar: CORS, ocultar los errores técnicos en todo el backend, `JWT_SECRET` nuevo, copias de seguridad y `TRUST_PROXY`.
- Completar el aviso de privacidad: responsable (la empresa), correo de contacto y proveedor de alojamiento.
- Actualizar los documentos de la tesis (metodología, plan de pruebas y modelo de datos) con todos los cambios.
