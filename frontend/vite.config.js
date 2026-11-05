import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Permite abrir la aplicación desde otros equipos de la
  // misma red (por ejemplo, un celular que escanea el QR)
  // usando la IP de esta computadora.
  server: {
    host: true
  }
})
