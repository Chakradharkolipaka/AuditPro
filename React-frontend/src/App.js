import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuditDashboard from "@/pages/AuditDashboard";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuditDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
