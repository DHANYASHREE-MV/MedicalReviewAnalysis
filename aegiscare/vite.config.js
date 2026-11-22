import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE is set by the GitHub Pages workflow ("/MedicalReviewAnalysis/"); local dev serves from "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
