// pages/useAuthAndFirebase.js
import { useState, useEffect } from "react";
// ... (other Firebase imports)

// --- FIREBASE CONFIGURATION (Using the hardcoded configuration provided previously) ---
const customFirebaseConfig = {
    apiKey: "AIzaSyBRyHQF2IWzPoOrm8UsgcdJvDIxEQR2G40",
    authDomain: "asa1db.firebaseapp.com",
    projectId: "asa1db",
    storageBucket: "asa1db.firebasestorage.app",
    messagingSenderId: "195882381688",
    appId: "1:195882381688:web:88e69407ef003bb8c7188d"
};

let app = null;
// ... (db and auth initialization)

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// FIX: Use the hardcoded Project ID as the App ID
const rawAppId = 'asa1db'; 
// 👇 NEW: Export the static ID for use in other files
export const STATIC_APP_ID = rawAppId; 
const appId = rawAppId; 

export const useAuthAndFirebase = (showSystemMessage) => {
    // ... (rest of the hook logic)

    return {
        auth, 
        db, 
        userId, 
        isAuthReady,
        signInWithGoogle,
        signInWithGithub,
        handleLogout,
        // appId, // ❌ REMOVED: No longer need to return the static ID here
    };
};
