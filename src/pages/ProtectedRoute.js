// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase"; // adjust path if needed

function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <div>Loading...</div>; // show spinner if you want
  }

  // If user exists, show the protected page
  // If not, redirect to login
  return user ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;
