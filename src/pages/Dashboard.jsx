/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useRef, useEffect, useCallback } from "react";

// 1. FIREBASE IMPORTS
import { 
    initializeApp 
} from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signOut, // <-- Added signOut for logout functionality
    signInAnonymously,
    signInWithCustomToken
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
  // Removed unused imports: getDoc, updateDoc, writeBatch
} from 'firebase/firestore';

// Global variables provided by the Canvas environment
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'vercel-local-dev'; 
const appId = rawAppId.split(/[\/\-]/)[0]; // Sanitize the app ID
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// Initialize App and Services (outside the component)
const app = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

// Initial video data (as referenced in dash 1.txt)
const INITIAL_VIDEOS = [
    { id: "v1", url: "https://vimeo.com/832360431", title: "Midnight City Drive", description: "A late-night cruise through the neon glow.", category: "Vlog" },
    { id: "v2", url: "https://vimeo.com/433126938", title: "Coffee Brew ASMR", description: "The soothing sound of a perfect morning brew.", category: "ASMR" },
    { id: "v3", url: "https://vimeo.com/791886869", title: "Mountain Peak Ascent", description: "Reaching the summit after a challenging hike.", category: "Nature" },
    { id: "v4", url: "https://vimeo.com/508603673", title: "Vintage Synthesizer Demo", description: "Exploring the sounds of classic analog gear.", category: "Music" },
];


const providers = {
    google: new GoogleAuthProvider(),
    github: new GithubAuthProvider(),
};

// Main App Component
export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState("home");
  const [videos, setVideos] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState({}); // {videoId: true}
  const [videoStats, setVideoStats] = useState({}); // {videoId: {likes: N, comments: M}}
  const [videoComments, setVideoComments] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [showModal, setShowModal] = useState(null); // { title: string, message: string, onClose: function }

  // --- REFS ---
  const videoRef = useRef(null);
  const chatScrollRef = useRef(null);

  // --- 5. UI LOGIC & HELPERS (Moved to the top to resolve ReferenceError) ---

  // Filter videos based on search term
  const filteredVideos = videos.filter(video => 
    video.title?.toLowerCase().includes(search.toLowerCase()) || 
    video.description?.toLowerCase().includes(search.toLowerCase()) ||
    video.category?.toLowerCase().includes(search.toLowerCase())
  );
  
  // Determine the currently displayed video
  const currentVideo = filteredVideos.length > 0 ? filteredVideos[index % filteredVideos.length] : null;


  // --- 2. AUTHENTICATION & INITIALIZATION ---
  useEffect(() => {
    if (!auth) {
        console.error("Firebase Auth is not initialized.");
        setIsAuthReady(true); // Treat as ready even if failed
        return;
    }

    const initAuth = async () => {
        try {
            if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Initial authentication failed:", error);
            // Fallback to anonymous sign-in if custom token fails
            try {
                await signInAnonymously(auth);
            } catch (anonError) {
                console.error("Anonymous sign-in failed:", anonError);
            }
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserId(user ? user.uid : null);
            setIsAuthReady(true);
        });

        return () => unsubscribe();
    };

    initAuth();
  }, []);

  // --- NEW LOGOUT FUNCTION ---
  const handleLogout = useCallback(async () => {
    if (!auth) {
        console.error("Auth object is null. Cannot log out.");
        return;
    }
    try {
      await signOut(auth);
      // After sign out, the onAuthStateChanged listener will fire,
      // setting userId to null and triggering all dependent effects to clear data.
      console.log("User signed out successfully.");
      setActiveTab("home"); // Navigate away from the profile after logging out
    } catch (error) {
      console.error("Error signing out:", error);
      setShowModal({
          title: "Logout Error", 
          message: `Failed to sign out: ${error.message}`, 
          onClose: () => setShowModal(null)
      });
    }
  }, [auth]);


  // --- 3. FIRESTORE DATA FETCHERS ---

  // 3a. Fetch Videos (Public Collection)
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const videosRef = collection(db, `artifacts/${appId}/public/data/videos`);
    
    const unsubscribe = onSnapshot(videosRef, (snapshot) => {
      if (snapshot.empty && videos.length === INITIAL_VIDEOS.length) {
        console.log("No videos found. Populating initial data...");
        
        INITIAL_VIDEOS.forEach(video => {
          setDoc(doc(videosRef, video.id), {...video, timestamp: serverTimestamp()}).catch(e => console.error("Error setting initial video:", e));
        });
        setVideos(INITIAL_VIDEOS);
        return;
      }
      
      const fetchedVideos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); // Sort by timestamp DESC

      if (fetchedVideos.length > 0) {
        setVideos(fetchedVideos);
      }

    }, (error) => {
      console.error("Error fetching videos:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, videos.length]); // Added videos.length to dependency array

  // 3b. Fetch User Likes (Private Collection)
  useEffect(() => {
    // Only fetch likes if user is logged in
    if (!isAuthReady || !userId || !db) {
      setLikes({}); // Clear likes if logged out
      return; 
    }

    const likesRef = collection(db, `artifacts/${appId}/users/${userId}/likes`);
    
    const unsubscribe = onSnapshot(likesRef, (snapshot) => {
      const userLikes = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.active !== false) {
           userLikes[doc.id] = true; 
        }
      });
      setLikes(userLikes);
    }, (error) => {
      console.error("Error fetching likes:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, userId, db, appId]);


  // 3c. Fetch Video Comments (Public Collection)
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const commentsRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
    const q = query(commentsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allComments = {};
      
      snapshot.docs.forEach(doc => {
        const commentData = doc.data();
        const videoId = commentData.videoId;
        
        if (videoId) {
          if (!allComments[videoId]) {
            allComments[videoId] = [];
          }
          allComments[videoId].push({
            id: doc.id,
            text: commentData.text,
            userId: commentData.userId,
            timestamp: commentData.timestamp?.toDate() || new Date(),
          });
        }
      });
      
      // Sort comments by timestamp client-side
      Object.keys(allComments).forEach(videoId => {
        allComments[videoId].sort((a, b) => a.timestamp - b.timestamp);
      });

      setVideoComments(allComments);
    }, (error) => {
      console.error("Error fetching comments:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, appId]);

  // 3d. Fetch Video Stats (Public Collection)
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const statsRef = collection(db, `artifacts/${appId}/public/data/videoStats`);
    const q = query(statsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = {};
      snapshot.docs.forEach(doc => {
        stats[doc.id] = doc.data();
      });
      setVideoStats(stats);
    }, (error) => {
      console.error("Error fetching video stats:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, appId]);


  // 3e. Fetch Chat Messages (Public Collection)
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const chatsRef = collection(db, `artifacts/${appId}/public/data/globalChat`);
    // NOTE: For simplicity, not adding an orderBy query, but in real app, you would sort by timestamp
    const q = query(chatsRef); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })).sort((a, b) => a.timestamp - b.timestamp); // Sort client-side
      setChatMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, appId]);


  // --- 4. DATA MUTATION HANDLERS ---

  // Utility function for social sign-in
  const handleSocialSignIn = async (providerName) => {
    if (!auth) {
        console.error("Auth object is null. Cannot sign in.");
        return;
    }
    const provider = providers[providerName];
    if (!provider) return;

    try {
      await signInWithPopup(auth, provider);
      setShowModal(null); // Close modal on success
    } catch (error) {
      console.error(`Error signing in with ${providerName}:`, error);
      setShowModal({
          title: "Sign In Failed", 
          message: `Could not sign in with ${providerName}: ${error.message}`, 
          onClose: () => setShowModal(null)
      });
    }
  };


  // Handle Like/Unlike
  const toggleLike = useCallback(async (videoId, isCurrentlyLiked) => {
    if (!userId || !db) {
        setShowModal({
            title: "Authentication Required", 
            message: "You must be signed in to like videos.", 
            onClose: () => setShowModal(null)
        });
        return;
    }

    const likeRef = doc(db, `artifacts/${appId}/users/${userId}/likes`, videoId);
    const statsRef = doc(db, `artifacts/${appId}/public/data/videoStats`, videoId);

    try {
        await runTransaction(db, async (transaction) => {
            const statsDoc = await transaction.get(statsRef);
            let newLikesCount = statsDoc.exists ? statsDoc.data().likes || 0 : 0;
            
            if (isCurrentlyLiked) {
                // Remove like
                transaction.set(likeRef, { active: false, timestamp: serverTimestamp() }, { merge: true });
                newLikesCount = Math.max(0, newLikesCount - 1);
            } else {
                // Add like
                transaction.set(likeRef, { active: true, timestamp: serverTimestamp() }, { merge: true });
                newLikesCount += 1;
            }

            // Update global stats
            transaction.set(statsRef, { likes: newLikesCount }, { merge: true });
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
        setShowModal({
            title: "Like Failed", 
            message: "Failed to process your like/unlike. Please try again.", 
            onClose: () => setShowModal(null)
        });
    }
  }, [userId, db, appId]);

  // Handle Video Comment
  const addVideoComment = useCallback(async () => {
    // currentVideo is now guaranteed to be defined before this callback
    if (!userId || !commentInput.trim() || !db || !currentVideo) {
        if (!userId) {
             setShowModal({
                title: "Authentication Required", 
                message: "You must be signed in to comment.", 
                onClose: () => setShowModal(null)
            });
        }
        return;
    }

    try {
      // 1. Add comment to public comments collection
      const commentRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
      await addDoc(commentRef, {
        videoId: currentVideo.id,
        userId: userId,
        text: commentInput.trim(),
        timestamp: serverTimestamp(),
      });
      setCommentInput(""); // Clear input

      // 2. Atomically update global stats (comments count)
      const statsRef = doc(db, `artifacts/${appId}/public/data/videoStats`, currentVideo.id);
      
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        let newCommentsCount = statsDoc.exists ? statsDoc.data().comments || 0 : 0;
        newCommentsCount += 1;
        transaction.set(statsRef, { comments: newCommentsCount }, { merge: true });
      });

    } catch (e) {
      console.error("Error adding comment or updating stats:", e);
      setShowModal({
          title: "Comment Failed", 
          message: "Failed to post comment. Please try again.", 
          onClose: () => setShowModal(null)
      });
    }
  }, [userId, commentInput, db, appId, currentVideo]);

  // Handle Global Chat Message
  const sendChatMessage = useCallback(async () => {
    if (!userId || !chatInput.trim() || !db) return;

    try {
      const chatRef = collection(db, `artifacts/${appId}/public/data/globalChat`);
      await addDoc(chatRef, {
        userId: userId,
        text: chatInput.trim(),
        timestamp: serverTimestamp(),
      });
      setChatInput("");
    } catch (e) {
      console.error("Error sending chat message:", e);
      setShowModal({
          title: "Chat Failed", 
          message: "Failed to send message. Please try again.", 
          onClose: () => setShowModal(null)
      });
    }
  }, [userId, chatInput, db, appId]);


  // --- 5. UI LOGIC & HELPERS (Cont.) ---

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);
  
  // Reset index when video list is filtered out
  useEffect(() => {
    if (filteredVideos.length > 0) {
        const currentVideoStillExists = filteredVideos.some(v => v.id === currentVideo?.id);
        if (!currentVideoStillExists) {
            setIndex(0); // Reset to first filtered video
        }
    }
  }, [search, filteredVideos.length, currentVideo]);

  // If filtered videos is empty, reset index and show placeholder
  if (filteredVideos.length === 0 && videos.length > 0 && search !== "") {
    return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#111", color: "white" }}>
            <p>No videos match your search term "<span style={{color: '#FFD700'}}>{search}</span>" 😔</p>
        </div>
    );
  }

  // --- COMPONENTS ---
  
  const SystemModal = () => {
      if (!showModal) return null;

      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={showModal.onClose}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              width: '90%',
              maxWidth: '400px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(255, 215, 0, 0.5)',
              border: '1px solid #FFD700',
            }}
            onClick={e => e.stopPropagation()} // Prevent closing when clicking modal content
          >
            <h3 style={{ color: '#FFD700', marginTop: 0 }}>{showModal.title}</h3>
            <p style={{ marginBottom: '20px' }}>{showModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {showModal.options && showModal.options.map((opt, i) => (
                    <button
                        key={i}
                        onClick={() => { opt.action(); setShowModal(null); }}
                        style={{
                            padding: '10px 15px',
                            background: opt.type === 'primary' ? '#006400' : '#444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
                {!showModal.options && (
                    <button
                        onClick={showModal.onClose}
                        style={{
                            padding: '10px 15px',
                            background: '#006400',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            width: '100%'
                        }}
                    >
                        Close
                    </button>
                )}
            </div>
            
            {showModal.signIn && (
                <div style={{ marginTop: '20px' }}>
                    <button
                        onClick={() => handleSocialSignIn('google')}
                        style={{ 
                            padding: '10px 15px', 
                            background: '#DB4437', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            cursor: 'pointer', 
                            margin: '5px' 
                        }}
                    >
                        Sign in with Google
                    </button>
                    <button
                        onClick={() => handleSocialSignIn('github')}
                        style={{ 
                            padding: '10px 15px', 
                            background: '#333', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            cursor: 'pointer', 
                            margin: '5px' 
                        }}
                    >
                        Sign in with GitHub
                    </button>
                </div>
            )}
          </div>
        </div>
      );
  }; 

  const Home = () => {
    // Use currentVideo which is defined globally in the component body
    if (!currentVideo) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>Loading videos...</div>;

    const videoId = currentVideo.id;
    
    const isLiked = likes[videoId];
    
    // Use the public videoStats for accurate social counts
    const currentStats = videoStats[videoId] || { likes: 0, comments: 0 };
    const likeCount = currentStats.likes;
    const commentCount = currentStats.comments;


    const actionButtonStyle = {
        background: "rgba(0, 0, 0, 0.35)", 
        borderRadius: '50%',
        width: '55px',
        height: '55px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: "none", 
        color: "white", 
        cursor: "pointer", 
        transition: 'background 0.2s, transform 0.1s',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        padding: 0,
    };
    
    const iconStyle = {
        fontSize: '2.5rem', 
        marginBottom: '4px',
    };


    return (
      <div
        style={{
          height: "calc(100vh - 60px)", // Adjusted for bottom nav
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "black",
          overflow: "hidden",
        }}
        onWheel={(e) => {
          if (e.deltaY > 0) {
            setIndex(prev => (prev + 1) % filteredVideos.length); // Next video
          } else if (e.deltaY < 0) {
            setIndex(prev => (prev - 1 + filteredVideos.length) % filteredVideos.length); // Previous video
          }
        }}
      >
        {/* Video Player (Using a simple iframe for Vimeo) */}
        <iframe
          ref={videoRef}
          src={`${currentVideo.url}?autoplay=1&loop=1&title=0&byline=0&portrait=0`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          title={currentVideo.title}
        />

        {/* Content Overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 40%)",
            pointerEvents: "none", // Allows clicks/swipes to pass through
          }}
        />

        {/* Video Info (Bottom Left) */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 20,
            color: "white",
            maxWidth: "70%",
            pointerEvents: "none",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>
            {currentVideo.title}
          </h1>
          <p style={{ fontSize: "1rem", margin: "5px 0 0" }}>
            {currentVideo.description}
          </p>
          <span style={{ 
            fontSize: "0.8rem", 
            padding: "3px 8px", 
            borderRadius: "5px", 
            background: '#FFD700', 
            color: 'black',
            fontWeight: '600',
            marginTop: '5px',
            display: 'inline-block',
          }}>
            #{currentVideo.category}
          </span>
        </div>

        {/* Action Buttons (Bottom Right) */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            right: 20,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            pointerEvents: "all",
          }}
        >
          {/* Like Button */}
          <button
            onClick={() => toggleLike(videoId, isLiked)}
            style={{ 
                ...actionButtonStyle, 
                color: isLiked ? '#FFD700' : 'white', // Highlight if liked
            }}
          >
            <span style={iconStyle}>{isLiked ? '❤️' : '🤍'}</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{likeCount}</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => setActiveTab('comments')}
            style={actionButtonStyle}
          >
            <span style={iconStyle}>💬</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{commentCount}</span>
          </button>
        </div>

        {/* Swipe Hint */}
        <div
          style={{
            position: "absolute",
            bottom: 150, 
            width: "100%",
            textAlign: "center",
            color: "white",
            fontSize: "0.8rem",
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          👆 Drag up/down or swipe to watch next
        </div>
      </div>
    );
  };

  const Comments = () => {
    // Use currentVideo which is defined globally in the component body
    if (!currentVideo) return null;

    const videoId = currentVideo.id;
    const currentComments = videoComments[videoId] || [];

    return (
        <div style={{ padding: 20, color: "white", background: "#111", flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#FFD700', margin: '0 0 15px' }}>💬 Comments for "{currentVideo.title}"</h2>
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                marginBottom: '15px', 
                paddingRight: '10px',
                maxHeight: 'calc(100vh - 250px)' 
              }}
            >
              {currentComments.length === 0 ? (
                <div style={{ opacity: 0.7, textAlign: 'center', marginTop: '20px' }}>No comments yet. Be the first!</div>
              ) : (
                currentComments.map((comment) => (
                  <div 
                    key={comment.id} 
                    style={{ 
                      marginBottom: "12px", 
                      padding: "10px", 
                      background: 'rgba(255, 255, 255, 0.1)', 
                      borderRadius: '8px'
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#00BFFF', fontSize: '0.9rem' }}>
                      {comment.userId === userId ? 'You' : `User: ${comment.userId.substring(0, 8)}...`}
                    </p>
                    <p style={{ margin: '5px 0 0', wordWrap: 'break-word' }}>{comment.text}</p>
                    <small style={{ opacity: 0.6, fontSize: '0.75rem', display: 'block', textAlign: 'right' }}>
                        {comment.timestamp.toLocaleTimeString()}
                    </small>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={userId ? "Add a comment…" : "Sign in to comment..."}
                disabled={!userId} // Input is only disabled if user is NOT logged in
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: userId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  color: "black",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
              <button
                onClick={addVideoComment}
                disabled={!commentInput.trim() || !userId}
                style={{
                  background: (!commentInput.trim() || !userId) ? "#aaa" : "#FFD700",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  color: "black",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: 'background 0.3s'
                }}
              >
                Send
              </button>
            </div>
        </div>
    );
  };

  const Chats = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ color: '#FFD700', margin: '0 0 15px' }}>💬 Global Chat</h2>
      
      <div 
        ref={chatScrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          marginBottom: '15px', 
          paddingRight: '10px',
          maxHeight: 'calc(100vh - 250px)' 
        }}
      >
        {chatMessages.length === 0 ? (
          <div style={{ opacity: 0.7, textAlign: 'center', marginTop: '20px' }}>Start the conversation!</div>
        ) : (
          chatMessages.map((msg) => (
            <div 
              key={msg.id} 
              style={{ 
                marginBottom: "12px", 
                display: 'flex',
                justifyContent: msg.userId === userId ? 'flex-end' : 'flex-start' 
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  background: msg.userId === userId ? '#006400' : '#333',
                  padding: '10px 15px',
                  borderRadius: '15px',
                  borderTopRightRadius: msg.userId === userId ? '4px' : '15px',
                  borderTopLeftRadius: msg.userId === userId ? '15px' : '4px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: msg.userId === userId ? '#FFD700' : '#00BFFF' }}>
                  {msg.userId === userId ? 'You' : `User: ${msg.userId.substring(0, 8)}...`}
                </p>
                <p style={{ margin: '3px 0 0' }}>{msg.text}</p>
                <small style={{ display: 'block', textAlign: 'right', fontSize: '0.65rem', opacity: 0.7 }}>
                  {msg.timestamp.toLocaleTimeString()}
                </small>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Input */}
      <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder={userId ? "Type your message here…" : "Sign in to chat..."}
          disabled={!userId}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.4)",
            background: userId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
            color: "black",
            fontSize: "0.95rem",
            outline: "none",
          }}
        />
        <button
          onClick={sendChatMessage}
          disabled={!chatInput.trim() || !userId}
          style={{
            background: (!chatInput.trim() || !userId) ? "#aaa" : "#FFD700",
            border: "none",
            borderRadius: "10px",
            padding: "12px 16px",
            color: "black",
            fontWeight: "bold",
            cursor: "pointer",
            transition: 'background 0.3s'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );

  const Explore = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ color: '#FFD700', margin: '0 0 15px' }}>🔍 Explore Videos</h2>
      <input
        type="text"
        placeholder="Search titles, descriptions, or categories..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.4)",
          background: "rgba(255,255,255,0.9)",
          color: "black",
          fontSize: "0.95rem",
          marginBottom: "20px",
          outline: "none",
        }}
      />
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
          {filteredVideos.map((video, idx) => (
              <div 
                  key={video.id} 
                  onClick={() => { setIndex(idx); setActiveTab('home'); setSearch(''); }}
                  style={{
                      display: 'flex',
                      gap: '15px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '15px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  }}
              >
                  <div style={{ flexShrink: 0, width: '100px', height: '60px', background: '#333', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                    🎬
                  </div>
                  <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 5px', fontWeight: 'bold', color: '#FFD700' }}>{video.title}</p>
                      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.description}</p>
                      <small style={{ display: 'block', marginTop: '5px', color: '#00BFFF' }}>#{video.category}</small>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );

  const Profile = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <h2 style={{ color: '#FFD700', marginBottom: '30px', borderBottom: '2px solid #FFD700', paddingBottom: '10px' }}>👤 Your Dashboard Profile</h2>
      
      <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '20px', 
          borderRadius: '15px', 
          width: '100%', 
          maxWidth: '400px', 
          textAlign: 'center',
          marginBottom: '30px'
      }}>
          <p style={{ margin: '0 0 10px', fontSize: '1.1rem' }}>
            Status: <span style={{ color: userId ? '#32CD32' : '#FF4500', fontWeight: 'bold' }}>
              {userId ? 'Authenticated' : 'Not Signed In'}
            </span>
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', wordBreak: 'break-all' }}>
            User ID: <span style={{ fontFamily: 'monospace', color: '#00BFFF' }}>{userId || 'N/A'}</span>
          </p>
      </div>

      {/* NEW LOGOUT BUTTON */}
      {userId && ( // Only show button if user is logged in
        <button
          onClick={handleLogout}
          style={{
            padding: '12px 30px',
            background: '#8B0000', // Dark Red for danger/logout
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.3s',
            boxShadow: '0 6px 15px rgba(139, 0, 0, 0.5)',
            maxWidth: '300px',
            alignSelf: 'center',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#FF4500'}
          onMouseOut={(e) => e.currentTarget.style.background = '#8B0000'}
        >
          👋 Log Out
        </button>
      )}
      
      {!userId && (
        <p style={{ textAlign: 'center', opacity: 0.7, marginTop: '20px' }}>
          Please sign in via the Home or Explore tab to get a persistent User ID.
        </p>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <Home />;
      case "comments": // Comments is treated as a sub-view of Home
        return <Comments />;
      case "chats":
        return <Chats />;
      case "explore":
        return <Explore />;
      case "profile":
        return <Profile />;
      default:
        return <Home />;
    }
  };


  // --- MAIN RENDER ---
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
      <div style={{ flex: 1 }}>{renderContent()}</div>
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
          zIndex: 10,
        }}
      >
        <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", opacity: activeTab === 'home' || activeTab === 'comments' ? 1 : 0.7 }}>
          🎬 Home
        </div>
        <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer", opacity: activeTab === 'chats' ? 1 : 0.7 }}>
          💬 Chats
        </div>
        <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", opacity: activeTab === 'profile' ? 1 : 0.7 }}>
          👤 Profile
        </div>
        <div onClick={() => setActiveTab("explore")} style={{ cursor: "pointer", opacity: activeTab === 'explore' ? 1 : 0.7 }}>
          🔍 Explore
        </div>
      </div>
    </div>
  );
}
