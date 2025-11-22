import React from "react";
import { auth, logout } from "../firebase";

function Dashboard() {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Dashboard</h2>
      <p>Welcome, {auth.currentUser?.email || auth.currentUser?.displayName}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default Dashboard;
