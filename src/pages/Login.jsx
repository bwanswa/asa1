import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdArrowBackIos } from "react-icons/md";
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
      signInWithEmailAndPassword(auth, email, password).catch((err) => {
        if (err.code === "auth/invalid-email") toast.error("Invalid email id!");
        if (err.code === "auth/user-not-found") toast.error("User not registered!");
        if (err.code === "auth/wrong-password") toast.error("You entered wrong password!");
        if (err.code === "auth/too-many-requests") toast.error("Too many attempts, Please try after sometime!");
      });
    }
  };

  // ✅ Redirect user to dashboard after successful login
  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const handleChange = (e) => setData({ ...Data, [e.target.name]: e.target.value });

  return (
    <div>
      {/* 🌈 FIXED TOP BAR */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          background: "linear-gradient(to right, #006400, #FFD700, #8B0000)",
          zIndex: 9999,
          height: "90px",
          fontFamily: "Segoe UI, sans-serif",
        }}
      >
        {/* LEFT SECTION: logo + ASA + subtitle + phones */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <img
              src={require("../assets/asa-logo.png")}
              alt="ASA Logo"
              style={{ width: "60px", height: "60px", borderRadius: "50%" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <div
              style={{
                color: "white",
                fontWeight: "bold",
                fontSize: "1.2rem",
                letterSpacing: "0.5px",
              }}
            >
              ASA
            </div>
            <div
              style={{
                color: "white",
                fontSize: "0.85rem",
                opacity: 0.95,
                marginTop: "2px",
              }}
            >
              One World. One Voice. One Future
            </div>
            <div
              style={{
                color: "white",
                fontSize: "0.75rem",
                opacity: 0.8,
                marginTop: "2px",
              }}
            >
              Tel: +256755317357 / +256771538829
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: language selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <select
            onChange={(e) => {
              const t = {
                en: "One World. One Voice. One Future",
                sw: "Dunia Moja. Sauti Moja. Maisha ya Kesho",
                fr: "Un Monde. Une Voix. Un Avenir",
              };
              const el = document.getElementById("headerText");
              if (el) el.textContent = t[e.target.value];
            }}
            style={{
              padding: "0.4rem",
              borderRadius: "5px",
              border: "none",
              fontWeight: "bold",
            }}
            defaultValue="en"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>

      {/* 🧠 LOGIN FORM BELOW BAR */}
      <div style={{ paddingTop: "110px" }}>
        <div className="flex items-center justify-between text-purple-500 font-bold mt-5 p-1">
          <Link to={"/register"}>
            <div className="cursor-pointer flex items-center text-xs">
              <MdArrowBackIos />
              Back to register
            </div>
          </Link>
          <div className="cursor-pointer text-xs">Need any help?</div>
        </div>

        <h1 className="text-2xl text-gray-800 text-center font-medium mt-5 p-2">Login</h1>
        <p className="text-gray-500 leading-5 text-center mb-2">Sign-in to continue</p>
        {error && <div className="my-4 text-center">{error.message}</div>}

        <form onSubmit={handlesubmit} className="flex flex-col justify-center items-center">
          <label className="relative">
            <input
              type="text"
              name="email"
              value={email}
              id="email"
              onChange={handleChange}
              className="my-2 mx-1 w-[270px] xs:w-[360px] md:w-[450px] px-6 py-3 rounded-full outline-none border border-gray-400 focus:border-purple-500 transition duration-200"
            />
            <span className="absolute top-5 text-gray-500 left-0 mx-6 px-2 transition duration-300 input-text">
              {email ? "" : "Email"}
            </span>
          </label>

          <label className="relative">
            <input
              type="password"
              name="password"
              value={password}
              id="password"
              onChange={handleChange}
              className="my-2 mx-1 w-[270px] xs:w-[360px] md:w-[450px] px-6 py-3 rounded-full outline-none border border-gray-400 focus:border-purple-500 transition duration-200"
            />
            <span className="absolute w-[80px] top-5 text-gray-500 left-0 mx-6 px-2 transition duration-300 input-text">
              {password ? "" : "Password"}
            </span>
          </label>

          <button
            type="submit"
            className="w-[270px] xs:w-[360px] md:w-[450px] p-2 bg-purple-700 text-white text-base font-medium md:font-semibold rounded-full mt-5 md:mt-4"
          >
            Submit
          </button>
        </form>

        <ToastContainer />

        <div className="flex items-center justify-center mt-5 text-gray-500">
          <div className="border w-[200px] border-gray-300 mr-1" />
          OR
          <div className="border w-[200px] border-gray-300 ml-1"></div>
        </div>

        <div className="flex flex-col items-center">
          <button
            type="button"
            className="w-[270px] sm:w-[360px] md:w-[450px] p-2 bg-gray-100 text-black text-base font-medium rounded-full mt-5 md:mt-4 flex items-center justify-center"
            onClick={() => signInWithGoogle()}
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/2991/2991148.png"
              alt="google"
              className="h-[25px] md:h-[28px] mr-[6px]"
            />
            Login with Google
          </button>

          <button
            type="button"
            className="w-[270px] xs:w-[360px] md:w-[450px] p-2 bg-white border-gray-200 border-[2px] text-base font-medium rounded-full my-5 md:mt-4 flex items-center justify-center"
            onClick={() => signInWithGithub()}
          >
            <img
              src={require("../assets/Github.png")}
              alt="github"
              className="h-[30px] sm:h-[36px] mr-[2px]"
            />
            Login with Github
          </button>

          <div className="text-gray-600 mt-2 mb-5">
            Don't have an account?{" "}
            <Link to={"/register"}>
              <span className="text-purple-500 font-medium">Register here</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
