// src/pages/Login.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, signInWithGithub, signInWithGoogle } from "../firebase.js";
import { useAuthState } from "react-firebase-hooks/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const initialState = { email: "", password: "" };

const Login = () => {
  const [Data, setData] = useState(initialState);
  const { password, email } = Data;
  const [user, loading, error] = useAuthState(auth);
  const navigate = useNavigate();

  const handlesubmit = (e) => {
    e.preventDefault();
    if (email === "") toast.error("Email-id is required!");
    else if (password === "") toast.error("Password is required!");
    else {
      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          // ✅ Navigate immediately after successful login
          navigate("/dashboard");
        })
        .catch((err) => {
          if (err.code === "auth/invalid-email") toast.error("Invalid email id!");
          if (err.code === "auth/user-not-found") toast.error("User not registered!");
          if (err.code === "auth/wrong-password") toast.error("You entered wrong password!");
          if (err.code === "auth/too-many-requests") toast.error("Too many attempts, Please try after sometime!");
        });
    }
  };

  // ✅ Redirect user to dashboard if already logged in (session persists)
  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const handleChange = (e) => setData({ ...Data, [e.target.name]: e.target.value });

  return (
    <div>
      <h1>Login</h1>
      {error && <div>{error.message}</div>}
      <form onSubmit={handlesubmit}>
        <input
          type="text"
          name="email"
          value={email}
          onChange={handleChange}
          placeholder="Email"
        />
        <input
          type="password"
          name="password"
          value={password}
          onChange={handleChange}
          placeholder="Password"
        />
        <button type="submit">Submit</button>
      </form>
      <ToastContainer />
      <button onClick={() => signInWithGoogle()}>Login with Google</button>
      <button onClick={() => signInWithGithub()}>Login with Github</button>
      <Link to="/register">Register here</Link>
    </div>
  );
};

export default Login;
