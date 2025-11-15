/* global __app_id */
import React, { useState, useRef, useEffect } from "react";

// 1. FIREBASE IMPORTS (Updated to include social auth providers)
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signOut
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
  runTransaction, // <-- IMPORTANT: Added for atomic social counts
  limit, // Added limit for chat query
  orderBy, // Added orderBy for chat query (will sort in JS per instruction)
} from 'firebase/firestore';

// Global variables provided by the Canvas environment (Only using __app_id for Firestore paths)
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'vercel-local-dev'; 
// Sanitize the app ID to ensure it is a single, clean segment for Firestore path construction.
const appId = rawAppId.split(/[\/\-]/)[0]; 

// --- USER'S FIREBASE CONFIGURATION (Using the hardcoded configuration provided previously) ---
const customFirebaseConfig = {
    apiKey: "AIzaSyBRyHQf2IWzPoOrm8UsgcdJvDIxEQR2G40",
    authDomain: "asa1db.firebaseapp.com",
    projectId: "asa1db",
    storageBucket: "asa1db.firebasestorage.app",
    messagingSenderId: "195882381688",
    appId: "1:195882381688:web:b12574044948f9df0f42b3",
};

// Initialize Firebase
const firebaseApp = initializeApp(customFirebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// --- UTILITIES & MOCK DATA ---

// Helper function to handle sign-in with a provider
const handleSignIn = async (provider) => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Sign-in error:", error);
    }
};

// --- CORE COMPONENTS ---

// 1. Home Screen (Now a Video Player)
const HomeScreen = ({ userId, displayName, photoURL }) => {
  // Videos for simulating the swipe experience
  const SAMPLE_VIDEOS = [
    { 
        url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", 
        title: "Big Buck Bunny (Sample Video)" 
    },
    { 
        url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", 
        title: "Elephants Dream (Sample Video)" 
    }
  ];
  
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const currentVideo = SAMPLE_VIDEOS[currentVideoIndex];
  
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const MIN_SWIPE_DISTANCE = 50; // Minimum distance in pixels for a swipe to register

  const handleTouchStart = (e) => {
    // Only care about the first touch point for vertical swipe
    setTouchStart(e.targetTouches[0].clientY);
    setTouchEnd(e.targetTouches[0].clientY); 
  };

  const handleTouchMove = (e) => {
    // Track the current position
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    // Calculate the distance and direction
    const distance = touchStart - touchEnd; // Positive value means upward swipe
    const isUpwardSwipe = distance > MIN_SWIPE_DISTANCE;

    if (isUpwardSwipe) {
      // Cycle to the next video
      setCurrentVideoIndex(prevIndex => (prevIndex + 1) % SAMPLE_VIDEOS.length);
    }
    // You could also add logic for downward swipe here
  };


  const HEADER_HEIGHT = 50;
  const NAV_HEIGHT = 50; 
  const PADDING = 20;

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      // The overall container is sized by the App component, so we just manage the internal layout.
      boxSizing: 'border-box',
    }}>
      {/* Header for the video player screen (Fixed top) */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        width: '100%', 
        backgroundColor: '#333', 
        color: 'white', 
        padding: '10px 20px', 
        textAlign: 'center',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
        zIndex: 10,
        height: `${HEADER_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#FFD700' }}>🎬 ASA Media Player</h2>
      </div>

      {/* Video Content Area (Main swippable/resizable area) */}
      <div 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
        style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: '#111',
          // Add padding to ensure the video isn't hidden by the fixed header/footer
          paddingTop: `${HEADER_HEIGHT}px`,
          paddingBottom: `${NAV_HEIGHT}px`,
          overflow: 'hidden', // Prevent default scroll for a better swipe feel
          touchAction: 'none', // Disable default touch actions
          boxSizing: 'border-box',
        }}
      >
        {/* Inner container for visual centering and padding */}
        <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: `${PADDING}px`,
            boxSizing: 'border-box',
          }}>
          <video 
            controls 
            autoPlay 
            muted
            // The video element takes up 90% of the available width/height of its flex container
            style={{ 
              maxWidth: '90%', 
              maxHeight: '90%', 
              width: 'auto', 
              height: 'auto', 
              borderRadius: '12px',
              border: '3px solid #006400',
              boxShadow: '0 0 20px rgba(0, 100, 0, 0.5)' 
            }}
            onError={(e) => {
                // Display a fallback message if the video fails to load
                e.target.style.display = 'none'; 
                const container = e.target.parentElement;
                if (container.querySelector('.video-error-message')) return;
                
                // Use DOM manipulation to show the error state (not ideal in React, but simple for this purpose)
                const errorDiv = document.createElement('div');
                errorDiv.className = 'video-error-message';
                errorDiv.innerHTML = '<h3 style="color:#FFD700; margin-bottom: 10px;">Video Stream Unavailable</h3><p style="color:#ccc;">Using a placeholder link. Please try another video source if needed.</p>';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.padding = '20px';
                errorDiv.style.backgroundColor = '#444';
                errorDiv.style.borderRadius = '8px';
                container.appendChild(errorDiv);
            }}
            key={currentVideo.url} // Key forces video component reload on URL change
          >
            <source src={currentVideo.url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Control / Info Bar below the video */}
          <div style={{ 
            padding: '10px 20px', 
            backgroundColor: '#222', 
            color: 'white',
            borderTop: '1px solid #444',
            width: '90%',
            maxWidth: '500px',
            borderRadius: '0 0 12px 12px',
            marginTop: '10px'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', textAlign: 'center' }}>
              Swipe up to watch next
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


// 2. Chat Screen
const ChatScreen = ({ db, userId, displayName, photoURL }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);
  const chatCollectionPath = `artifacts/${appId}/public/data/globalChat`;

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time message listener
  useEffect(() => {
    // 1. Create the query (using orderBy for later in-memory sort)
    // NOTE: orderBy is used here only to indicate the desired sort direction; actual sorting will be done in JS
    const q = query(collection(db, chatCollectionPath));
    
    // 2. Set up the snapshot listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ ...doc.data(), id: doc.id });
      });

      // 3. Sort messages in JavaScript (since Firestore orderBy is discouraged here)
      const sortedMessages = fetchedMessages.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime();
      });

      setMessages(sortedMessages);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
    });

    // 4. Clean up the listener on component unmount
    return () => unsubscribe();
  }, [db, chatCollectionPath]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !userId) return;

    try {
      await addDoc(collection(db, chatCollectionPath), {
        text: newMessage,
        timestamp: serverTimestamp(),
        userId: userId,
        userName: displayName || 'Anonymous',
        userPhoto: photoURL || null,
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Chat bar is ~50px, Input bar is ~60px. Total offset for padding: 110px + gap (20px) = 130px.
  // Header is 50px tall.
  const HEADER_HEIGHT = 50;
  const INPUT_HEIGHT = 60;
  const NAV_HEIGHT = 50; 
  const INPUT_BOTTOM_OFFSET = 50; // Position input 50px above screen bottom (where nav bar starts)
  const TOTAL_BOTTOM_PADDING = NAV_HEIGHT + INPUT_HEIGHT + 10; // For scrollable area clearance

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header (Fixed) - UPDATED TITLE */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        width: '100%', 
        backgroundColor: '#333', 
        color: '#FFD700', 
        padding: '10px 20px', 
        textAlign: 'center',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
        zIndex: 10,
        height: `${HEADER_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>⭐ ASA Global Chat ⭐</h2>
      </div>

      {/* Message List (Scrollable Content) */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '10px 20px',
          paddingTop: `${HEADER_HEIGHT + 10}px`, // Offset for header
          paddingBottom: `${TOTAL_BOTTOM_PADDING}px`, // Offset for input and nav
        }}
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{
              display: 'flex',
              justifyContent: msg.userId === userId ? 'flex-end' : 'flex-start',
              marginBottom: '10px',
            }}
          >
            <div 
              style={{
                maxWidth: '70%',
                backgroundColor: msg.userId === userId ? '#006400' : '#444',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '15px',
                borderBottomRightRadius: msg.userId === userId ? '4px' : '15px',
                borderBottomLeftRadius: msg.userId === userId ? '15px' : '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: msg.userId === userId ? '#FFD700' : '#87CEEB', marginBottom: '5px' }}>
                {msg.userName}
              </div>
              <p style={{ margin: 0 }}>{msg.text}</p>
              <span style={{ fontSize: '0.7rem', color: '#ccc', display: 'block', textAlign: 'right', marginTop: '5px' }}>
                {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input (Fixed and lifted above Nav Bar) */}
      <div 
        style={{ 
          position: 'fixed', 
          bottom: `${INPUT_BOTTOM_OFFSET}px`, // Lifts it up 50px (above the nav bar)
          width: '100%', 
          backgroundColor: '#222', 
          padding: '10px 20px', 
          boxShadow: '0 -2px 5px rgba(0,0,0,0.5)',
          zIndex: 10,
          height: `${INPUT_HEIGHT}px`,
          boxSizing: 'border-box', // Include padding in height calculation
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <form onSubmit={sendMessage} style={{ display: 'flex', width: '100%' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            style={{
              flexGrow: 1,
              padding: '10px 15px',
              borderRadius: '25px',
              border: '2px solid #FFD700',
              backgroundColor: '#111',
              color: 'white',
              outline: 'none',
              fontSize: '1rem',
            }}
          />
          <button
            type="submit"
            style={{
              marginLeft: '10px',
              backgroundColor: '#006400',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#004d00'}
            onMouseOut={e => e.target.style.backgroundColor = '#006400'}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};


// 3. Profile Screen
const ProfileScreen = ({ userId, displayName, photoURL, isAnon }) => {
  const providers = [
    { name: "Google", provider: new GoogleAuthProvider(), icon: "G" },
    { name: "GitHub", provider: new GithubAuthProvider(), icon: "🐈" }
  ];

  const handleSignOut = () => {
    signOut(auth).catch((error) => console.error("Sign-out error:", error));
  };

  return (
    <div style={{ padding: '20px', color: 'white', overflowY: 'auto', paddingTop: '60px', paddingBottom: '60px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px', color: '#FFD700', textAlign: 'center' }}>User Profile</h1>

      <div style={{ 
        backgroundColor: '#333', 
        padding: '20px', 
        borderRadius: '12px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <img 
          src={photoURL || "https://placehold.co/100x100/333333/FFFFFF?text=👤"} 
          alt="Profile" 
          style={{ width: '100px', height: '100px', borderRadius: '50%', marginBottom: '15px', border: '3px solid #006400' }} 
          onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/333333/FFFFFF?text=👤" }}
        />
        <h2 style={{ margin: '10px 0 5px 0', fontSize: '1.5rem' }}>{displayName || "Anonymous User"}</h2>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#ccc', textAlign: 'center', wordBreak: 'break-all' }}>ID: {userId}</p>

        {isAnon ? (
          <p style={{ color: '#FFD700', textAlign: 'center' }}>
            You are currently signed in anonymously. Sign in below to save your data and use your display name in chat.
          </p>
        ) : (
          <p style={{ color: '#006400', textAlign: 'center' }}>
            You are securely authenticated.
          </p>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '5px', marginBottom: '15px', color: '#FFD700' }}>Authentication</h3>
        {isAnon && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {providers.map(p => (
              <button
                key={p.name}
                onClick={() => handleSignIn(p.provider)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: p.name === 'Google' ? '#DB4437' : '#24292e',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseOver={e => e.target.style.opacity = 0.8}
                onMouseOut={e => e.target.style.opacity = 1}
              >
                <span style={{ marginRight: '10px', fontSize: '1.2rem' }}>{p.icon}</span>
                Sign in with {p.name}
              </button>
            ))}
          </div>
        )}
        {!isAnon && (
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#8B0000',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#6e0000'}
            onMouseOut={e => e.target.style.backgroundColor = '#8B0000'}
          >
            Sign Out
          </button>
        )}
      </div>

    </div>
  );
};


// 4. System Modal
const SystemModal = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  }}>
    <div style={{
      backgroundColor: '#222',
      padding: '30px',
      borderRadius: '15px',
      color: 'white',
      textAlign: 'center',
      maxWidth: '80%',
      boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
      border: '2px solid #FFD700'
    }}>
      <h3 style={{ color: '#FFD700', marginBottom: '15px' }}>Initializing System...</h3>
      <p>Establishing secure connection to ASA Services.</p>
      <div style={{ marginTop: '20px' }}>
        <div style={{ 
          height: '10px', 
          backgroundColor: '#444', 
          borderRadius: '5px', 
          overflow: 'hidden' 
        }}>
          <div style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: '#006400', 
            animation: 'loading-bar 1.5s infinite linear',
            borderRadius: '5px',
          }} />
        </div>
      </div>
    </div>
    <style>{`
      @keyframes loading-bar {
        0% { transform: translateX(-100%) }
        100% { transform: translateX(100%) }
      }
    `}</style>
  </div>
);


// --- MAIN APP COMPONENT ---
const App = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // 1. Authentication Listener and Initialization
  useEffect(() => {
    // Attempt to sign in anonymously first if no user is found
    const initializeAuth = async () => {
        try {
            await auth.signInAnonymously();
        } catch (error) {
            console.error("Anonymous sign-in failed:", error);
        }
    };
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      setShowModal(false); // Hide modal once auth status is confirmed
    });

    // If we're loading and haven't checked auth yet, try anonymous sign-in
    if (!auth.currentUser) {
        initializeAuth();
    }

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const userId = user?.uid || crypto.randomUUID();
  const displayName = user?.displayName;
  const photoURL = user?.photoURL;
  const isAnon = user?.isAnonymous;

  const renderContent = () => {
    if (!isAuthReady) {
      return null;
    }

    switch (activeTab) {
      case "home":
        return <HomeScreen userId={userId} displayName={displayName} photoURL={photoURL} />;
      case "chats":
        return <ChatScreen db={db} userId={userId} displayName={displayName} photoURL={photoURL} />;
      case "profile":
        return <ProfileScreen userId={userId} displayName={displayName} photoURL={photoURL} isAnon={isAnon} />;
      default:
        return null;
    }
  };

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
    >
      <div style={{ flex: 1, overflowY: 'hidden' }}>{renderContent()}</div>
      {showModal && <SystemModal />}

      {/* Bottom Navigation Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          background: "linear-gradient(to right, #006400, #FFD700, #8B0000)",
          color: "white",
          padding: "10px 0",
          position: "fixed",
          bottom: 0,
          width: "100%",
          fontWeight: "600",
          fontSize: "0.9rem",
          zIndex: 20, // Increased Z-index to ensure it sits on top
          height: '50px', // Explicit height for better positioning calculation
          boxSizing: 'border-box'
        }}
      >
        <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", opacity: activeTab === 'home' ? 1 : 0.7 }}>
          🎬 Home
        </div>
        <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer", opacity: activeTab === 'chats' ? 1 : 0.7 }}>
          💬 Chats
        </div>
        <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", opacity: activeTab === 'profile' ? 1 : 0.7 }}>
          👤 Profile
        </div>
      </div>
    </div>
  );
};

export default App;
