import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PublicMenu from './pages/PublicMenu';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Dashboard principale */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Pagina Menu Pubblica dedicata */}
        <Route path="/menu/:slug" element={<PublicMenu />} />
        
        {/* Fallback per link non validi */}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}
