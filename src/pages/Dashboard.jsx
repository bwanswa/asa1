/* global __app_id */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, LogOut, Loader, User, Home, MessageSquare, Heart, Clock, Menu } from 'lucide-react';

// 1. FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signOut,
    signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  addDoc, 
  serverTimestamp,
  runTransaction,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';

// --- CONFIGURATION ---
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'vercel-local-dev'; 
const appId = rawAppId.split(/[\/\-]/)[0]; 

// Use the hardcoded configuration (Assuming this is the correct config the user intended to use for deployment)
// NOTE: Vercel blank pages often happen because environment variables aren't loaded correctly.
// Using a hardcoded config here ensures Firebase initializes.
const firebaseConfig = {
    apiKey: "AIzaSyBRyHQf2IWzPoOrm8UsgcdJvDIxEQR2G40",
    authDomain: "asa1db.firebaseapp.com",
    projectId: "asa1db",
    storageBucket: "asa1db.firebasestorage.app",
    messagingSenderId: "195882381688",
    appId: "1:195882381688:web:0b2d3544d651268b81a070",
};

// --- INITIALIZE FIREBASE & UTILS ---
let app, db, auth;
// Set up globals to be initialized in useEffect
let currentUserId = null;

// Initialize Firebase only once
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  // Log level for Firebase debugging
  // import { setLogLevel } from "firebase/firestore";
  // setLogLevel('debug'); 
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Fixed dimensions for layout
const HEADER_HEIGHT = 60;
const NAV_HEIGHT = 70;

// --- DUMMY DATA / CONSTANTS ---
const DUMMY_PROFILES = [
  { id: '1', name: 'AI Tutor', bio: 'I can teach you anything.' },
  { id: '2', name: 'Fitness Coach', bio: 'Your personal workout guide.' },
  { id: '3', name: 'ChefBot', bio: 'The best recipes are mine.' },
  { id: '4', name: 'Historian Bot', bio: 'Facts from the past.' },
];
const DUMMY_FEED_ITEM = {
    id: 'post-1',
    author: 'Admin',
    content: "Welcome to the new Gemini dashboard! Explore the chats and profiles.",
    timestamp: new Date().toLocaleTimeString(),
    likes: 5,
    likedByMe: false,
    commentsCount: 2,
};


// --- APP COMPONENT ---
export default function App() {
  const [activeTab, setActiveTab] = useState("home"); // 'home', 'chats', 'profile'
  const [user, setUser] = useState(null); // Firebase user object
  const [isAuthReady, setIsAuthReady] = useState(false); // Crucial for Vercel deployment stability
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  
  // State for Firestore data
  const [feedItems, setFeedItems] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);

  // 1. FIREBASE AUTHENTICATION EFFECT
  useEffect(() => {
    if (!auth) return; // Guard if Firebase failed to initialize

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // 1. Set the user state (null or User object)
      setUser(currentUser);
      currentUserId = currentUser ? currentUser.uid : null;

      // 2. Set the Auth Ready State to true after the initial check
      setIsAuthReady(true);
      
      // 3. Handle sign-in/out for user metadata (optional, but good practice)
      if (currentUser) {
        const userRef = doc(db, 'userMetadata', currentUser.uid);
        // Ensure user metadata exists for counts/profiles
        await setDoc(userRef, { 
          lastLogin: serverTimestamp(),
          name: currentUser.displayName || 'Anonymous User',
          email: currentUser.email || 'N/A',
          photoURL: currentUser.photoURL || null,
        }, { merge: true });
      }
    });

    // Clean up listener on component unmount
    return () => unsubscribe();
  }, []); // Run only once on mount

  // 2. FIRESTORE DATA FETCHING EFFECT (RUNS AFTER AUTH IS READY)
  useEffect(() => {
    // CRITICAL GUARD: Do not run Firestore operations until Auth is ready.
    if (!db || !isAuthReady) {
      console.log("Firestore/Auth not ready, skipping data fetch.");
      return; 
    }

    // A. Fetch Feed (Public)
    const feedQuery = query(collection(db, `artifacts/${appId}/public/data/feed`), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribeFeed = onSnapshot(feedQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Client-side mapping for the current user's like status (simplistic check)
        likedByMe: doc.data().likes?.includes(currentUserId) || false,
      }));
      if (items.length === 0) {
        // Seed with a dummy post if the feed is empty
        items.push(DUMMY_FEED_ITEM);
      }
      setFeedItems(items);
    }, (err) => console.error("Feed snapshot error:", err));

    // B. Fetch Chat List (User-specific private data)
    let unsubscribeChats = () => {};
    if (user) {
        const chatQuery = query(collection(db, `artifacts/${appId}/users/${user.uid}/chats`), orderBy('lastUpdated', 'desc'), limit(5));
        unsubscribeChats = onSnapshot(chatQuery, (snapshot) => {
            setChatList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => console.error("Chat snapshot error:", err));
    } else {
        // Clear chats if user logs out
        setChatList([]);
    }

    // C. Fetch Total User Count (Public/Aggregated)
    const userCountRef = doc(db, 'publicMetadata', 'user_counts');
    const unsubscribeCounts = onSnapshot(userCountRef, (docSnap) => {
        if (docSnap.exists()) {
            setTotalUsers(docSnap.data().totalUsers || 0);
        } else {
            // Initialize if it doesn't exist
            setDoc(userCountRef, { totalUsers: 1, initDate: serverTimestamp() }, { merge: true });
            setTotalUsers(1);
        }
    }, (err) => console.error("User count snapshot error:", err));

    // Cleanup function for all listeners
    return () => {
      unsubscribeFeed();
      unsubscribeChats();
      unsubscribeCounts();
    };

  }, [db, isAuthReady, user]); // Re-run when Firebase objects are ready or user changes


  // --- HANDLERS ---

  // NOTE: In a production app, you would use environment variables for keys. 
  // For this environment, we use the custom fetch utility and an empty key.
  const handleGeminiChat = async (prompt, botName) => {
    // Simplified logic: Just logging the prompt
    console.log(`Sending prompt to ${botName}: ${prompt}`);
    
    // Simulate API call and state update
    const newChat = {
        id: crypto.randomUUID(),
        model: "gemini-1.5-flash",
        prompt,
        response: `[Simulated response from ${botName}] I'm thinking about "${prompt}"...`,
        timestamp: new Date().toLocaleTimeString(),
        botName: botName,
    };

    // Save chat to Firestore (Private)
    if (user) {
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/chats`), {
                ...newChat,
                lastUpdated: serverTimestamp(),
                userId: user.uid,
                timestamp: serverTimestamp(), // Use server timestamp for saving
            });
        } catch (e) {
            console.error("Error adding document: ", e);
            setError("Could not save chat. Check console for details.");
        }
    } else {
        setError("You must be logged in to chat.");
        setShowModal(true);
    }
  };

  // Social Authentication Handler (Google, Github, or Anonymous)
  const handleSocialAuth = async (providerName) => {
    let provider;
    if (providerName === 'Google') provider = new GoogleAuthProvider();
    else if (providerName === 'Github') provider = new GithubAuthProvider();
    else if (providerName === 'Anonymous') {
      try {
        await signInAnonymously(auth);
        setShowModal(false);
        return;
      } catch (error) {
        console.error("Anonymous sign in failed:", error);
        setError("Anonymous sign-in failed. Try again.");
        return;
      }
    }
    
    try {
      await signInWithPopup(auth, provider);
      setShowModal(false);
    } catch (error) {
      console.error("Authentication failed:", error);
      setError(`Authentication with ${providerName} failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
      setError("Logout failed. Try again.");
    }
  };

  const handleLike = useCallback(async (postId, isLiked) => {
    if (!user) {
        setError("You must be logged in to like posts.");
        setShowModal(true);
        return;
    }

    const postRef = doc(db, `artifacts/${appId}/public/data/feed`, postId);
    const userId = user.uid;

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(postRef);
            if (!docSnap.exists()) {
                throw "Document does not exist!";
            }
            
            const currentLikes = docSnap.data().likes || [];
            let newLikes = [...currentLikes];

            if (isLiked) {
                // Unlike: remove userId from the array
                newLikes = newLikes.filter(id => id !== userId);
            } else {
                // Like: add userId to the array (if not already present)
                if (!newLikes.includes(userId)) {
                    newLikes.push(userId);
                }
            }
            
            transaction.update(postRef, { likes: newLikes });
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
        setError("Failed to update like count. Please try again.");
    }
  }, [db, user]);

  // --- UI COMPONENTS ---

  const SystemModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full text-center">
        <h3 className="text-xl font-bold mb-4 text-red-600">Authentication Required</h3>
        <p className="mb-6 text-gray-700">{error || "Please sign in to access this feature."}</p>
        <button
            onClick={() => handleSocialAuth('Anonymous')}
            className="w-full bg-yellow-500 text-white py-3 rounded-xl font-semibold mb-2 shadow-md hover:bg-yellow-600 transition duration-150"
        >
            Sign in Anonymously
        </button>
        <button
            onClick={() => handleSocialAuth('Google')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold mb-2 shadow-md hover:bg-blue-700 transition duration-150"
        >
            Sign in with Google
        </button>
        <button
            onClick={() => handleSocialAuth('Github')}
            className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold mb-4 shadow-md hover:bg-gray-900 transition duration-150"
        >
            Sign in with GitHub
        </button>
        <button 
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 text-sm"
        >
            Close
        </button>
      </div>
    </div>
  );

  const HomeTab = () => (
    <div className="p-4 space-y-4 max-w-xl mx-auto">
      {/* Metrics Header */}
      <div className="flex justify-around bg-gray-900 text-white p-4 rounded-xl shadow-lg">
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-400">{totalUsers}</p>
          <p className="text-sm">Active Users</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-400">{chatList.length}</p>
          <p className="text-sm">My Chats</p>
        </div>
      </div>

      {/* Feed Section */}
      <h2 className="text-xl font-bold text-white pt-4">Community Feed</h2>
      {feedItems.map((item) => {
        const isLiked = item.likes?.includes(user?.uid) || false;
        const likeCount = item.likes?.length || 0;

        return (
          <div key={item.id} className="bg-gray-800 p-4 rounded-xl shadow-lg text-white">
            <p className="text-xs text-gray-400 mb-1">Posted by {item.author} at {item.timestamp}</p>
            <p className="text-lg mb-3">{item.content}</p>
            <div className="flex items-center space-x-4 text-sm">
              <button 
                onClick={() => handleLike(item.id, isLiked)}
                className={`flex items-center transition duration-150 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-300'}`}
              >
                <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} className="mr-1" />
                {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
              </button>
              <div className="flex items-center text-gray-400">
                <MessageSquare size={20} className="mr-1" />
                {item.commentsCount || 0} Comments
              </div>
            </div>
          </div>
        )
      })}
      
      <button 
          className="w-full bg-yellow-600 text-white py-2 rounded-xl font-semibold shadow-lg hover:bg-yellow-700 transition duration-150 mt-4"
          onClick={() => setActiveTab('chats')}
      >
          Start a New Chat
      </button>
    </div>
  );

  const ChatsTab = () => (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-white pb-2 border-b border-gray-700">Recent Chats</h2>
      
      {user ? (
          chatList.length > 0 ? (
              chatList.map((chat) => (
                  <div key={chat.id} className="bg-gray-800 p-4 rounded-xl shadow-md cursor-pointer hover:bg-gray-700 transition duration-150">
                      <p className="text-lg font-semibold text-yellow-400">{chat.botName || 'General Chat'}</p>
                      <p className="text-sm text-gray-300 truncate">{chat.prompt}</p>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                          <Clock size={14} className="mr-1" />
                          Last updated: {chat.lastUpdated ? new Date(chat.lastUpdated.toDate()).toLocaleTimeString() : 'N/A'}
                      </p>
                  </div>
              ))
          ) : (
              <div className="text-center text-gray-500 py-10">
                  <p>You haven't started any chats yet.</p>
              </div>
          )
      ) : (
        <div className="text-center text-gray-400 py-10">
            <p className="mb-4">Please sign in to view your chat history.</p>
            <button 
                onClick={() => setShowModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-150"
            >
                Sign In
            </button>
        </div>
      )}

      <h2 className="text-xl font-bold text-white pt-4 pb-2 border-b border-gray-700">Start a New Chat</h2>
      <div className="grid grid-cols-2 gap-4">
        {DUMMY_PROFILES.map(profile => (
            <button 
                key={profile.id}
                onClick={() => handleGeminiChat(`Start a conversation with me about ${profile.name.toLowerCase()}`, profile.name)}
                className="bg-green-700 text-white p-4 rounded-xl shadow-lg hover:bg-green-600 transition duration-150 text-left"
            >
                <User size={24} className="mb-2 text-yellow-300" />
                <p className="font-semibold">{profile.name}</p>
                <p className="text-xs text-gray-300">{profile.bio.split(' ')[0]}...</p>
            </button>
        ))}
      </div>
    </div>
  );

  const ProfileTab = () => (
    <div className="p-4 max-w-xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white pb-2 border-b border-gray-700">My Profile</h2>
      {user ? (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold text-white">
              {user.displayName ? user.displayName[0] : 'A'}
            </div>
            <div>
              <p className="text-xl font-bold text-white">{user.displayName || "Anonymous User"}</p>
              <p className="text-sm text-yellow-400">{user.email || "No email provided"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400">User ID (for Public Sharing):</p>
            <div className="bg-gray-700 p-2 rounded-lg break-all text-sm text-gray-200">
                {user.uid}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center bg-red-600 text-white py-3 rounded-xl font-semibold shadow-md hover:bg-red-700 transition duration-150 mt-4"
          >
            <LogOut size={20} className="mr-2" />
            Sign Out
          </button>
        </div>
      ) : (
        <div className="text-center text-gray-400 py-10 bg-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-lg mb-4">You are currently signed out.</p>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition duration-150 shadow-md"
          >
            Sign In / Sign Up
          </button>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    // 3. CRITICAL LOADING STATE: Show loading until auth state is definitively known
    if (!isAuthReady) {
      return (
        <div className="flex items-center justify-center h-full bg-black text-white">
          <Loader size={32} className="animate-spin mr-2 text-yellow-500" />
          <p>Loading Authentication...</p>
        </div>
      );
    }
    
    switch (activeTab) {
      case "home":
        return <HomeTab />;
      case "chats":
        return <ChatsTab />;
      case "profile":
        return <ProfileTab />;
      default:
        return <HomeTab />;
    }
  };
  
  // Overall Layout
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "black",
        fontFamily: 'Inter, sans-serif'
      }}
      className="text-white"
    >
        {/* Top Header */}
        <div 
            style={{ height: `${HEADER_HEIGHT}px` }} 
            className="flex items-center justify-between p-4 bg-gray-900 shadow-xl fixed top-0 w-full z-10"
        >
            <div className="text-2xl font-extrabold text-white">
                <span className="text-yellow-500">G</span>emini <span className="text-green-500">1.5</span>
            </div>
            <button onClick={() => setActiveTab('profile')} className="text-gray-400 hover:text-white transition duration-150">
                <Menu size={24} />
            </button>
        </div>

      {/* Main Content Area */}
      <div 
        style={{
          paddingTop: `${HEADER_HEIGHT}px`,
          paddingBottom: `${NAV_HEIGHT}px`,
          overflowY: 'auto',
          flex: 1, // Allow content to fill the space
        }}>
        {renderContent()}
      </div>

      {showModal && <SystemModal />}

      {/* Bottom Navigation Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          background: "linear-gradient(to right, #006400, #FFD700, #8B0000)", 
          color: "white",
          position: "fixed",
          bottom: 0,
          width: "100%",
          zIndex: 20, 
          height: `${NAV_HEIGHT}px`,
          boxSizing: 'border-box',
          boxShadow: '0 -2px 5px rgba(0,0,0,0.5)',
          padding: '0 10px',
        }}
      >
        <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", opacity: activeTab === 'home' ? 1 : 0.6, fontSize: '1.8rem', padding: '0 10px' }} title="Home">
          🎬
        </div>
        <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer", opacity: activeTab === 'chats' ? 1 : 0.6, fontSize: '1.8rem', padding: '0 10px' }} title="Chats">
          💬
        </div>
        <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", opacity: activeTab === 'profile' ? 1 : 0.6, fontSize: '1.8rem', padding: '0 10px' }} title="Profile">
          👤
        </div>
      </div>
    </div>
  );
}
