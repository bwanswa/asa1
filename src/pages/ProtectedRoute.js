// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  // Check if user is logged in (example: token stored in localStorage)
  const isLoggedIn = localStorage.getItem("token");

  // If logged in, render the children (Dashboard, etc.)
  // If not, redirect to login
  return isLoggedIn ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;
