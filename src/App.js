import { Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./pages/ProtectedRoute";

function App() {
  const isLoggedIn = localStorage.getItem("token"); // session check

  return (
    <div className="App">
      <Routes>
        {/* Login & Register */}
        <Route
          path="/login"
          element={
            <div className="max-w-[90%] md:max-w-[50%] mx-auto">
              <Login />
            </div>
          }
        />
        <Route
          path="/register"
          element={
            <div className="max-w-[90%] md:max-w-[50%] mx-auto">
              <Register />
            </div>
          }
        />

        {/* Default route: if logged in → dashboard, else → login */}
        <Route
          path="/"
          element={isLoggedIn ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
        />

        {/* Protected Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
