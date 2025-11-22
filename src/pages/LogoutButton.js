import React from "react";
import { logout } from "../firebase";

function LogoutButton() {
  return <button onClick={logout}>Logout</button>;
}

export default LogoutButton;
