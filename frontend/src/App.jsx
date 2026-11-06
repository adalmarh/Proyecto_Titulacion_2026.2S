import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import {
  useContext,
  useState
} from "react";

import {
  AuthContext
} from "./context/AuthContext";

import { ROLES } from "./utils/permisos";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PanelProductor from "./pages/PanelProductor";
import PanelCertificador from "./pages/PanelCertificador";
import Lotes from "./pages/Lotes";
import Productores from "./pages/Productores";
import Usuarios from "./pages/Usuarios";
import Trazabilidad from "./pages/Trazabilidad";
import Certificaciones from "./pages/Certificaciones";
import CodigosQR from "./pages/CodigosQR";
import ConsultaPublicaQR from "./pages/ConsultaPublicaQR";
import SolicitarCuenta from "./pages/SolicitarCuenta";
import Solicitudes from "./pages/Solicitudes";
import MiPerfil from "./pages/MiPerfil";
import Privacidad from "./pages/Privacidad";
import VerificarCertificado from "./pages/VerificarCertificado";
import AceptarPrivacidad from "./components/AceptarPrivacidad";


const { ADMIN, PRODUCTOR, CERTIFICADOR } = ROLES;


// ==========================================
// RUTA PROTEGIDA
// - Sin sesión: vuelve al login.
// - Con sesión pero sin el rol necesario:
//   vuelve al inicio de su rol.
// ==========================================

const RutaProtegida = ({
  roles,
  children
}) => {

  const {
    usuario,
    cargando
  } = useContext(
    AuthContext
  );


  if (cargando) {
    return (
      <div className="cargando">
        Cargando...
      </div>
    );
  }


  if (!usuario) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  if (
    roles &&
    !roles.includes(usuario.rol)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }


  return children;

};


// ==========================================
// LAYOUT PRINCIPAL
// ==========================================

const Layout = ({
  children
}) => {

  // Estado del menú responsive
  const [
    menuAbierto,
    setMenuAbierto
  ] = useState(false);

  const abrirMenu = () => {
    setMenuAbierto(true);
  };

  const cerrarMenu = () => {
    setMenuAbierto(false);
  };


  return (
    <div className="app-layout">

      <Sidebar
        menuAbierto={menuAbierto}
        cerrarMenu={cerrarMenu}
      />

      <div className="main-area">

        <Navbar
          abrirMenu={abrirMenu}
        />

        <main className="content">
          {children}
        </main>

        {/* Pide aceptar el aviso de privacidad si hace falta */}
        <AceptarPrivacidad />

      </div>

    </div>
  );

};


// ==========================================
// INICIO SEGÚN EL ROL
// Cada rol tiene su propia página de inicio.
// ==========================================

const Inicio = () => {

  const { usuario } = useContext(AuthContext);

  if (usuario?.rol === PRODUCTOR) {
    return <PanelProductor />;
  }

  if (usuario?.rol === CERTIFICADOR) {
    return <PanelCertificador />;
  }

  return <Dashboard />;

};


// Página privada: ruta protegida + layout
const Privada = ({
  roles,
  children
}) => (
  <RutaProtegida roles={roles}>
    <Layout>
      {children}
    </Layout>
  </RutaProtegida>
);


// ==========================================
// APLICACIÓN
// ==========================================

const App = () => {

  return (
    <BrowserRouter>

      <Routes>

        {/* LOGIN */}
        <Route
          path="/"
          element={<Login />}
        />


        {/* VERIFICACIÓN DE CERTIFICADOS (público, QR del PDF) */}
        <Route
          path="/verificar/:codigo"
          element={<VerificarCertificado />}
        />


        {/* AVISO DE PRIVACIDAD (público) */}
        <Route
          path="/privacidad"
          element={<Privacidad />}
        />


        {/* SOLICITAR CUENTA (público) */}
        <Route
          path="/solicitar-cuenta"
          element={<SolicitarCuenta />}
        />


        {/* INICIO (todos los roles) */}
        <Route
          path="/dashboard"
          element={
            <Privada>
              <Inicio />
            </Privada>
          }
        />


        {/* MI PERFIL (todos los roles) */}
        <Route
          path="/perfil"
          element={
            <Privada>
              <MiPerfil />
            </Privada>
          }
        />


        {/* LOTES */}
        <Route
          path="/lotes"
          element={
            <Privada roles={[ADMIN, PRODUCTOR]}>
              <Lotes />
            </Privada>
          }
        />


        {/* PRODUCTORES */}
        <Route
          path="/productores"
          element={
            <Privada roles={[ADMIN]}>
              <Productores />
            </Privada>
          }
        />


        {/* USUARIOS */}
        <Route
          path="/usuarios"
          element={
            <Privada roles={[ADMIN]}>
              <Usuarios />
            </Privada>
          }
        />


        {/* SOLICITUDES DE CUENTA */}
        <Route
          path="/solicitudes"
          element={
            <Privada roles={[ADMIN]}>
              <Solicitudes />
            </Privada>
          }
        />


        {/* TRAZABILIDAD (todos los roles) */}
        <Route
          path="/trazabilidad"
          element={
            <Privada>
              <Trazabilidad />
            </Privada>
          }
        />


        {/* CERTIFICACIONES (todos los roles) */}
        <Route
          path="/certificaciones"
          element={
            <Privada>
              <Certificaciones />
            </Privada>
          }
        />


        {/* CÓDIGOS QR */}
        <Route
          path="/qr"
          element={
            <Privada roles={[ADMIN, PRODUCTOR]}>
              <CodigosQR />
            </Privada>
          }
        />


        {/* CONSULTA PÚBLICA QR (consumidor final, sin sesión) */}
        <Route
          path="/publico/qr/:token"
          element={<ConsultaPublicaQR />}
        />


        {/* RUTA NO ENCONTRADA */}
        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );

};


export default App;
