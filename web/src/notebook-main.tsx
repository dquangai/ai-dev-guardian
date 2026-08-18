import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { NoteBook } from './pages/NoteBook'
import { ThemeProvider } from './context/ThemeContext'

/**
 * Standalone entry for the public GitHub Pages guide deploy — renders only
 * NoteBook, not the authenticated dashboard (App.tsx), so the public bundle
 * never ships dashboard route code. A catch-all route means the in-page
 * "/login" links (which have nowhere real to go on a static host) just
 * re-render this same page instead of hitting a dead route.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
        <Routes>
          <Route path="*" element={<NoteBook />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
