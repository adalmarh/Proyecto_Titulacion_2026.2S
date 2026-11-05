# Pruebas de roles (semana 1: backend)

Base de la API: `http://localhost:5000/api`. En las peticiones con token, añade el encabezado `Authorization: Bearer <token>`.

## 1. Preparar los usuarios de prueba

Inicia sesión como administrador (`POST /auth/login`) y guarda el token. Con ese token, crea un usuario de cada rol con `POST /usuarios`:

```json
{ "nombre": "Ana", "apellido": "Asociación", "email": "asociacion@prueba.com",
  "password": "123456", "rol": "asociacion", "asociacion": "<id de la asociación>" }
```

```json
{ "nombre": "Pedro", "apellido": "Productor", "email": "productor@prueba.com",
  "password": "123456", "rol": "productor", "productor": "<id de un productor registrado>" }
```

```json
{ "nombre": "Carla", "apellido": "Certificadora", "email": "certificador@prueba.com",
  "password": "123456", "rol": "certificador" }
```

Después, como administrador, asigna la certificadora a una certificación:
`PATCH /certificaciones/<id>/asignar-certificador` con `{ "certificador": "<id de Carla>" }`.

Inicia sesión con cada usuario y guarda los cuatro tokens.

## 2. Casos de prueba

| N.º | Usuario | Petición | Resultado esperado |
|---|---|---|---|
| R01 | Sin token | `GET /lotes` | 401 |
| R02 | Sin token | `POST /auth/registro` | 401 (el registro ya no es público) |
| R03 | Productor | `POST /usuarios` | 403 |
| R04 | Sin token | `GET /usuarios/certificadores` | 401 |
| R05 | Administrador | `GET /lotes` | 200, todos los lotes |
| R06 | Asociación | `GET /lotes` | 200, solo lotes de su asociación |
| R07 | Productor | `GET /lotes` | 200, solo sus lotes |
| R08 | Certificador | `GET /lotes` | 200, solo lotes de sus certificaciones asignadas |
| R09 | Productor | `GET /lotes/<id de un lote de otro productor>` | 403 |
| R10 | Productor | `POST /trazabilidad` en su lote | 201 |
| R11 | Productor | `POST /trazabilidad` en un lote ajeno | 403 |
| R12 | Productor | `POST /lotes` | 403 |
| R13 | Asociación | `PUT /lotes/<id de un lote de otra asociación>` | 403 |
| R14 | Asociación | `POST /productores` enviando otra asociación | 201, pero queda en SU asociación |
| R15 | Certificador | `GET /certificaciones` | 200, solo las asignadas a él |
| R16 | Certificador | `PATCH /certificaciones/<id no asignada>/aprobar` | 403 |
| R17 | Certificador | `POST /trazabilidad` | 403 |
| R18 | Productor | `POST /qr/lote/<id de su lote>` | 200 o 201 |
| R19 | Productor | `PATCH /qr/lote/<id de su lote>/regenerar` | 403 |
| R20 | Administrador | `PATCH /usuarios/<id del productor>/estado` con `{ "activo": false }` y luego `GET /lotes` con el token del productor | 200 y después 403 "Usuario desactivado" |
| R21 | Cualquiera | `GET /public/qr/<token>` (consulta del consumidor final) | 200 sin iniciar sesión |

Guarda una captura de cada resultado: sirven como evidencia para el capítulo de pruebas.

## 3. Pruebas automáticas

Desde la carpeta `backend`, ejecuta `npm test`. Son 10 pruebas del control de acceso que usan datos simulados (no tocan tu base de datos). Deben terminar con `pass 10` y `fail 0`.

## 4. Pruebas en la interfaz (semana 2)

| N.º | Usuario | Acción | Resultado esperado |
|---|---|---|---|
| I01 | Administrador | Revisar el menú lateral | Dashboard, Lotes, Productores, Asociaciones, Trazabilidad, Certificaciones, Códigos QR y Usuarios |
| I02 | Asociación | Revisar el menú lateral | Sin Asociaciones ni Usuarios; el encabezado muestra el nombre de su asociación |
| I03 | Productor | Revisar el menú lateral | Mi panel, Mis lotes, Trazabilidad, Certificaciones y Códigos QR |
| I04 | Certificador | Revisar el menú lateral | Mi panel, Trazabilidad y Mis certificaciones |
| I05 | Certificador | Escribir `/usuarios` en la barra de direcciones | Vuelve a su panel |
| I06 | Administrador | Usuarios → Nuevo usuario con rol Productor | Se crea y aparece vinculado al productor elegido |
| I07 | Administrador | Desactivar un usuario y entrar con él | "Usuario desactivado" en el inicio de sesión |
| I08 | Asociación | Productores → Nuevo productor | La asociación aparece fija y el productor se crea en ella |
| I09 | Productor | Mis lotes | Sin botones Nuevo lote, Editar ni Desactivar |
| I10 | Productor | Trazabilidad → registrar una actividad en su lote | Se registra; no aparece el botón de eliminar |
| I11 | Certificador | Mi panel → Revisar → Rechazar sin observaciones | No se envía y pide el motivo |
| I12 | Certificador | Mi panel → Revisar → Aprobar | La certificación pasa a "Mis dictámenes" con botón PDF |
| I13 | Cualquiera | En F12 → Application → Local Storage, cambiar el valor de `token` por cualquier texto y recargar | Vuelve al inicio de sesión con el aviso de sesión expirada |

## 5. Consulta pública desde un celular (semana 3)

El celular y la computadora deben estar en la misma red Wi-Fi.

1. En la computadora, abre CMD y ejecuta `ipconfig`. Anota la «Dirección IPv4» de tu red Wi-Fi (por ejemplo, `192.168.1.20`).
2. En `backend/.env`, cambia la variable a `QR_FRONTEND_URL=http://192.168.1.20:5173` (con tu IP).
3. Reinicia el backend (`npm run dev` en `backend`) y el frontend (`npm run dev` en `frontend`). Vite mostrará también una dirección «Network».
4. Si Windows pregunta por el firewall para Node.js, permite el acceso en redes privadas.
5. Entra como administrador → Códigos QR → **Ver QR** → **Regenerar código** del lote. Los QR anteriores apuntan a `localhost`, que en el celular no existe.
6. Escanea el QR con el celular.

| N.º | Prueba | Resultado esperado |
|---|---|---|
| P01 | Escanear el QR de un lote con certificación aprobada y vigente | Sello con ✓, «Certificación … vigente hasta …» y el recorrido del lote |
| P02 | Escanear un lote sin certificación | «Sin certificación registrada» |
| P03 | Regenerar el QR y escanear el código ANTERIOR | «Este código QR no está activo» |
| P04 | Desactivar el QR y escanearlo | «Este código QR no está activo» |
| P05 | Revisar la página | No aparecen cédula, teléfono ni correo del productor |
| P06 | Escanear dos veces y revisar el pie de página | El número de consultas aumenta |

## 6. Rediseño de las páginas (semana 4)

Revisar en escritorio y en el celular (o con F12 → modo dispositivo, 390 px de ancho).

| N.º | Rol | Acción | Resultado esperado |
|---|---|---|---|
| D01 | Todos | Recorrer todas las páginas | No queda ningún emoji; todos los iconos son de línea, del mismo estilo |
| D02 | Administrador | Lotes → Nuevo lote | El productor está bloqueado hasta elegir la asociación y solo lista los de esa asociación |
| D03 | Administrador | Lotes → Editar | Asociación y productor aparecen bloqueados; aparece «Fecha real de cosecha» |
| D04 | Asociación | Lotes → cambiar la etapa en la tabla | Mensaje «etapa actualizada» y la etiqueta cambia |
| D05 | Asociación | Lotes → botón QR de un lote sin código | Botón «Generar código QR»; al pulsarlo aparece la imagen |
| D06 | Productor | Lotes → QR | Puede ver y descargar; no aparecen «Regenerar» ni «Desactivar» |
| D07 | Administrador | Trazabilidad → elegir lote → registrar «Control de calidad» | La actividad aparece arriba en la línea de tiempo con su icono |
| D08 | Certificador | Trazabilidad → elegir lote | Solo ve el historial, sin formulario |
| D09 | Administrador | Certificaciones → Asignar | Se abre una ventana con la lista de certificadores (ya no la ventanita con números) |
| D10 | Administrador | Certificaciones → Dictaminar → Aprobar | Fecha de vencimiento propuesta a un año; la fila pasa a «Aprobada» con botón PDF |
| D11 | Administrador | Certificaciones → Rechazar en una solicitud pendiente | Solo se ofrece «Rechazar» y exige observaciones |
| D12 | Asociación | Códigos QR | Totales de lotes con QR, sin QR y escaneos; filtro «Sin código QR» funciona |
| D13 | Cualquiera | Abrir un formulario y pulsar Esc | La ventana se cierra |
| D14 | Cualquiera | En el celular, abrir Lotes y Certificaciones | La página no se desplaza a los lados; solo la tabla se desliza |

## 7. Pruebas de integración automáticas (semana 5)

1. En `backend/.env` agrega una línea con una base SOLO para pruebas (su nombre debe contener "prueba"):
   `MONGO_URI_PRUEBAS=mongodb://127.0.0.1:27017/agroseguro_pruebas`
2. En `backend`, ejecuta `npm run test:integracion`.
3. El script levanta su propio servidor en el puerto 5099, ejecuta 99 casos (incluye R01–R21 y las solicitudes de cuenta) y al final borra la base de pruebas. Tu base real no se usa.
4. El informe queda en `backend/pruebas/resultados/integracion-<fecha>.md`.

## 8. Solicitudes de cuenta (desde el inicio de sesión)

| N.º | Rol | Acción | Resultado esperado |
|---|---|---|---|
| SO01 | Sin sesión | Inicio de sesión → «Solicitar acceso» | Abre el formulario «Solicitar cuenta» |
| SO02 | Sin sesión | Elegir «Productor» y abrir la lista de asociaciones | Solo asociaciones registradas, sin la opción «no está en la lista» |
| SO03 | Sin sesión | Enviar con una cédula inventada (por ejemplo 1234567890) | «La cédula no es válida» |
| SO04 | Sin sesión | Enviar con contraseñas distintas | «Las contraseñas no coinciden» |
| SO05 | Sin sesión | Enviar la solicitud completa | Pantalla «Solicitud enviada» |
| SO06 | Sin sesión | Intentar entrar con ese correo antes de la aprobación | «Tu solicitud de cuenta aún está pendiente de aprobación» |
| SO07 | Asociación | Ver el menú | «Solicitudes» con el número de pendientes |
| SO08 | Asociación | Solicitudes | Solo productores que eligieron su asociación |
| SO09 | Asociación | Revisar → Aprobar | La persona ya puede entrar y aparece en Productores |
| SO10 | Administrador | Revisar una cuenta de asociación nueva sin elegir asociación | Pide seleccionar la asociación |
| SO11 | Administrador | Revisar → Rechazar sin motivo | Pide el motivo |
| SO12 | Sin sesión | Entrar con la cuenta rechazada | Muestra el motivo del rechazo |
| SO13 | Productor o certificador | Escribir `/solicitudes` en la barra | Lo devuelve a su inicio |
| SO14 | Sin sesión | Escribir un teléfono fijo (por ejemplo 042712345) en Celular | «El celular debe tener 10 dígitos y empezar con 09» |
| SO15 | Sin sesión | Productor sin parroquia o con «Cómo llegar a tu finca» muy corto | Pide completar la ubicación de la finca |
| SO16 | Asociación | Revisar una solicitud | Muestra celular (con enlace para llamar), ubicación y cómo llegar |
| SO17 | Asociación | Aprobar un productor nuevo y abrir Productores | Su ficha tiene el celular y la dirección de la finca |
| SO18 | Sin sesión | Enviar la solicitud sin marcar «He leído el aviso de privacidad» | No se envía |
| SO19 | Sin sesión | Abrir «Aviso de privacidad» desde el login, el formulario y la página pública del QR | Muestra el aviso completo con el correo de contacto |
| SO20 | Cuenta creada por el administrador | Iniciar sesión por primera vez | Pide aceptar el aviso; «No acepto» cierra la sesión; tras aceptar no vuelve a aparecer |

## 9. Firma del certificado PDF (manuscrita o electrónica)

Solo el certificador asignado firma. Puede imprimir el PDF, firmarlo a mano y escanearlo; ponerle su firma en Word y guardarlo como PDF; o, si tiene, firmarlo con FirmaEC. Antes de subirlo confirma que el documento ya tiene su firma.

| N.º | Rol | Acción | Resultado esperado |
|---|---|---|---|
| FE01 | Certificador | Mi panel con una certificación aprobada sin firmar | Aviso «… sin firmar» y botón «Firmar» |
| FE02 | Certificador | Firmar → Descargar PDF | Se descarga el certificado con QR de verificación y recuadro en blanco para la firma |
| FE03 | Certificador | Imprimir, firmar a mano, escanear como PDF y elegirlo, sin marcar la confirmación | El botón «Subir PDF firmado» queda desactivado |
| FE04 | Certificador | Marcar «Confirmo que este documento…» y subir | «PDF firmado guardado · Firmado por [nombre del certificador]» |
| FE05 | Certificador | Elegir una foto (.jpg) en lugar de un PDF | «El archivo debe ser un PDF…» |
| FE06 | Administrador | Certificaciones | La aprobada muestra «Firmada»; el botón PDF descarga la versión firmada; **no** tiene botón «Firmar» |
| FE07 | Productor | Certificaciones | Puede descargar el PDF firmado; no ve el botón de firma |
| FE08 | Sin sesión | Escanear el QR impreso en el PDF | «Certificado válido y vigente» y «Firmado por el certificador …» |
| FE09 | Sin sesión | En esa página, elegir el PDF firmado | «Este archivo es idéntico…»; con otro PDF: «no es idéntico» |
| FE10 | Certificador | (Opcional) Subir una versión firmada con FirmaEC o `npm run firmar-prueba` | «Firmado electrónicamente por …»; la verificación pública lo indica igual |
| FE11 | Sin sesión | Consulta pública del QR del lote | «Certificado firmado por …» y enlace «Verificar el certificado» |

## 10. Mi perfil

Se entra haciendo clic en el nombre del usuario, arriba a la derecha.

| N.º | Rol | Acción | Resultado esperado |
|---|---|---|---|
| PF01 | Productor | Clic en su nombre en la barra superior | Abre «Mi perfil» con nombre, correo, rol, asociación y fecha del aviso de privacidad |
| PF02 | Productor | Escribir `12345` en Celular y guardar | «El celular debe tener 10 dígitos y empezar con 09» |
| PF03 | Productor | Escribir un celular válido y guardar | «Celular actualizado»; la asociación lo ve en la ficha del productor |
| PF04 | Cualquiera | Cambiar la contraseña con la actual incorrecta | «La contraseña actual no es correcta» |
| PF05 | Cualquiera | Confirmación distinta de la nueva | «La confirmación no coincide…» |
| PF06 | Cualquiera | Cambiar la contraseña correctamente, con la sesión abierta también en otro navegador | «Contraseña cambiada»; este navegador sigue dentro; en el otro, al recargar, pide iniciar sesión |
| PF07 | Cualquiera | Cerrar sesión y entrar con la contraseña anterior y luego con la nueva | La anterior falla; la nueva entra |
