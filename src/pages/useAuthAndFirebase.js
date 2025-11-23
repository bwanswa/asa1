// pages/useAuthAndFirebase.js
import { useState, useEffect } from "react";
import { 
    initializeApp 
} from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { 
  getFirestore
} from 'firebase/firestore'; 

const customFirebaseConfig = {
    apiKey: "AIzaSyBRyHQF2IWzPoOrm8UsgcdJvDIxEQR2G40",
    authDomain: "asa1db.firebaseapp.com",
    projectId: "asa1db",
    storageBucket: "asa1db.firebasestorage.app",
    messagingSenderId: "195882381688",
    appId: "1:195882381688:web:88e69407ef003bb8c7188d"
};

let app = null;
let db = null;
let auth = null;

try {
  app = initializeApp(customFirebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error("Firebase initialization failed:", e);
}

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'vercel-local-dev';
const appId = rawAppId.split(/[\/\-]/)[0];

export const useAuthAndFirebase = (showSystemMessage) => {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);

    // Listen for auth state changes
    useEffect(() => {
        if (!auth || !db) {
            console.warn("Firebase services not initialized. Running in Read-Only / Demo mode.");
            setUserId(null); 
            setIsAuthReady(true);
            return; 
        }
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
            setIsAuthReady(true);
        });

        return () => unsubscribe();
    }, []);

    // Auth Handlers
    const signInWithGoogle = async () => {
        if (!auth) return showSystemMessage("Authentication not available.");
        try {
            await signInWithPopup(auth, googleProvider);
            showSystemMessage("Signed in with Google successfully!");
        } catch (err) {
            console.error(err);
            showSystemMessage(`Sign-in failed: ${err.message.substring(0, 50)}...`);
        }
    };
    
    const signInWithGithub = async () => {
        if (!auth) return showSystemMessage("Authentication not available.");
        try {
            await signInWithPopup(auth, githubProvider);
            showSystemMessage("Signed in with GitHub successfully!");
        } catch (err) {
            console.error(err);
            showSystemMessage(`Sign-in failed: ${err.message.substring(0, 50)}...`);
        }
    };
    
    const handleLogout = () => {
        if (!auth) return showSystemMessage("Authentication not available.");
        signOut(auth).then(() => {
            showSystemMessage("Logged out successfully.");
        }).catch(err => {
            console.error(err);
            showSystemMessage("Logout failed.");
        });
    };

    return {
        auth, 
        db, 
        userId, 
        isAuthReady,
        signInWithGoogle,
        signInWithGithub,
        handleLogout,
        appId
    };
};
