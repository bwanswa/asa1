import React, { useEffect, useState } from "react";
import { MdArrowBackIos } from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, signInWithGoogle, signInWithGithub } from "../firebase.js";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [user, loading, error] = useAuthState(auth);
  const navigate = useNavigate();

  const handlesubmit = (e) => {
    e.preventDefault();
    if (fullName === "") {
      toast.error("Full Name is required!");
    } else if (password === "") {
      toast.error("Password is required!");
    } else if (password.length < 8) {
      toast.error("Password must atleast be of 8 characters!");
    } else if (email === "") {
      toast.error("Email-id is required!");
    } else {
      createUserWithEmailAndPassword(auth, email, password)
        .then((userCredentials) => {
          console.log(userCredentials);
          // ✅ Redirect straight to dashboard after successful registration
          navigate("/dashboard");
        })
        .catch((err) => {
          if (err.code === "auth/email-already-in-use") {
            toast.error("Email already registered, login to continue");
          } else {
            toast.error("Error occured, please try again");
          }
        });
    }
  };
  // ✅ Redirect if session already active
  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="max-w-[100%] mx-auto">
      {/* ... your existing UI code unchanged ... */}
    </div>
  );
};

export default Register;
