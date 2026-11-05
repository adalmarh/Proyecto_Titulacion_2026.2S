import {
  LuSprout,
  LuDroplets,
  LuLeaf,
  LuSprayCan,
  LuBug,
  LuScissors,
  LuWarehouse,
  LuFactory,
  LuMicroscope,
  LuBadgeCheck,
  LuTruck,
  LuStore,
  LuCircleDashed
} from "react-icons/lu";


// ==========================================
// ÍCONO DE CADA TIPO DE ACTIVIDAD
// (reemplaza a los emojis). Se usa en la
// trazabilidad, el dashboard y la consulta
// pública del QR.
// ==========================================

export const ICONO_EVENTO = {
  siembra: LuSprout,
  riego: LuDroplets,
  fertilizacion: LuLeaf,
  fumigacion: LuSprayCan,
  control_fitosanitario: LuBug,
  cosecha: LuScissors,
  almacenamiento: LuWarehouse,
  procesamiento: LuFactory,
  control_calidad: LuMicroscope,
  certificacion: LuBadgeCheck,
  transporte: LuTruck,
  distribucion: LuStore,
  otro: LuCircleDashed
};

export const iconoEvento = (tipo) =>
  ICONO_EVENTO[tipo] || LuCircleDashed;
