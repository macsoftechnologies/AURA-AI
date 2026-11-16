import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Welcome from "./pages/Welcome";
import Chat from "./pages/Chat";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const TOKEN_KEY = "aura_access_token";

function ProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    const controller = new AbortController();

    async function verifyToken() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          localStorage.removeItem(TOKEN_KEY);
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setIsAuthenticated(false);
      }
    }

    void verifyToken();

    return () => controller.abort();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4f7fb",
          color: "#1e40af",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        Preparing your AURA experience...
      </div>
    );
  }

  return isAuthenticated ? <Chat /> : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />

        <Route path="/chat" element={<ProtectedRoute />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
