// ==========================================================
// REVISAR LOS USUARIOS EXISTENTES
// ----------------------------------------------------------
// Con el control de acceso por rol, cada usuario necesita
// su vínculo para ver datos:
//   - rol "productor": un Productor con su campo usuario.
// Este script SOLO LEE la base de datos y lista las cuentas
// a las que les falta el vínculo. No modifica nada.
//
// Uso, desde la carpeta backend:
//   node scripts/revisarUsuarios.js
// ==========================================================

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Usuario = require("../models/Usuario");
const Productor = require("../models/Productor");

const revisarUsuarios = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const usuarios = await Usuario.find()
      .select("nombre apellido email rol activo")
      .sort({ rol: 1 });

    const productores = await Productor.find({
      usuario: { $ne: null }
    }).select("usuario nombre apellido");

    const conProductor = new Map(
      productores.map((p) => [String(p.usuario), p])
    );

    console.log("\nUSUARIOS REGISTRADOS\n");

    let pendientes = 0;

    usuarios.forEach((u) => {
      let vinculo = "no necesita";

      if (u.rol === "productor") {
        const p = conProductor.get(String(u._id));
        vinculo = p
          ? `productor ${p.nombre} ${p.apellido}`
          : "FALTA PRODUCTOR";
      }

      if (vinculo.startsWith("FALTA")) {
        pendientes += 1;
      }

      console.log(
        `${u.rol.padEnd(14)} ${u.email.padEnd(32)} ${u.activo ? "activo  " : "inactivo"}  ${vinculo}`
      );
    });

    console.log(
      pendientes > 0
        ? `\n${pendientes} usuario(s) sin vínculo: no verán datos hasta que el administrador los vincule (PUT /api/usuarios/:id).\n`
        : "\nTodos los usuarios tienen su vínculo.\n"
    );

  } catch (error) {
    console.error("Error al revisar los usuarios:", error.message);
    process.exitCode = 1;

  } finally {
    await mongoose.disconnect();
  }
};

revisarUsuarios();
