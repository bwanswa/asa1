import { Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/HomePage";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <div className="App">
      <Routes>
        {/* Compact pages */}
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
        //<Route
          //path="/"
          //element={
            //<div className="max-w-[90%] md:max-w-[50%] mx-auto">
              //<HomePage />
            //</div>
          //}
        //>
        <Route
          path="/profile"
          element={
            <div className="max-w-[90%] md:max-w-[50%] mx-auto">
              //<Profile />
            </div>
          }
        />

        {/* Full-width Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;
