// ==========================================================
// CREAR EL PRIMER ADMINISTRADOR
// ----------------------------------------------------------
// Como el registro ya no es público, el primer administrador
// se crea desde la terminal (solo hace falta en una base de
// datos nueva).
//
// Uso, desde la carpeta backend:
//   node scripts/crearAdministrador.js "Nombre" "Apellido" correo@ejemplo.com contraseña
// ==========================================================

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const Usuario = require("../models/Usuario");

const crearAdministrador = async () => {
  const [nombre, apellido, email, password] = process.argv.slice(2);

  if (!nombre || !apellido || !email || !password) {
    console.log(
      'Uso: node scripts/crearAdministrador.js "Nombre" "Apellido" correo@ejemplo.com contraseña'
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.log("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const correo = email.trim().toLowerCase();

    if (await Usuario.exists({ email: correo })) {
      console.log(`Ya existe un usuario con el correo ${correo}.`);
      return;
    }

    await Usuario.create({
      nombre,
      apellido,
      email: correo,
      password: await bcrypt.hash(password, await bcrypt.genSalt(10)),
      rol: "administrador"
    });

    console.log(`Administrador ${correo} creado correctamente.`);

  } catch (error) {
    console.error("Error al crear el administrador:", error.message);
    process.exitCode = 1;

  } finally {
    await mongoose.disconnect();
  }
};

crearAdministrador();
