// ==========================================
// VALIDACIONES COMPARTIDAS
// ==========================================

// Cédula de identidad ecuatoriana (persona natural):
// 10 dígitos, provincia 01–24 (o 30 para ecuatorianos
// en el exterior), tercer dígito menor que 6 y dígito
// verificador según el algoritmo módulo 10.
const cedulaValida = (valor) => {
  const cedula = String(valor || "").trim();

  if (!/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) {
    return false;
  }

  if (Number(cedula[2]) >= 6) {
    return false;
  }

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let digito = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (digito > 9) digito -= 9;
    suma += digito;
  }

  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(cedula[9]);
};


const emailValido = (valor) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor || "").trim());


// Teléfono opcional: 7 a 15 dígitos, admite + y espacios
const telefonoValido = (valor) =>
  !valor || /^\+?[\d\s-]{7,15}$/.test(String(valor).trim());


// Celular ecuatoriano: 10 dígitos que empiezan con 09.
// Se aceptan espacios o guiones al escribirlo.
const normalizarCelular = (valor) => String(valor || "").replace(/[\s-]/g, "");

const celularValido = (valor) => /^09\d{8}$/.test(normalizarCelular(valor));


// Las 24 provincias del Ecuador
const PROVINCIAS_ECUADOR = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
  "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
  "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
  "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas",
  "Sucumbíos", "Tungurahua", "Zamora Chinchipe"
];


module.exports = {
  cedulaValida,
  emailValido,
  telefonoValido,
  normalizarCelular,
  celularValido,
  PROVINCIAS_ECUADOR
};
