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
    appId: "1:195882381688:web:88e69407ef003bb8c7188d"
};

// Initializing Firebase (outside of component to avoid re-init)
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


// Initial Video Data Structure for seeding Firestore
const INITIAL_VIDEOS = [
  { id: "v1", src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Global Initiative", desc: "Connecting the world" },
  { id: "v2", src: "https://www.w3schools.com/html/movie.mp4", title: "Future of Digital Learning", desc: "Exploring emerging technologies" },
  { id: "v3", src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Volunteer Spotlight Series", desc: "Making a difference in communities" },
];


const Dashboard = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null); // userId is null when logged out
  const [videos, setVideos] = useState(INITIAL_VIDEOS);
  
  // NEW STATE: Stores public like/comment counts per video
  const [videoStats, setVideoStats] = useState({}); // {videoId: {likes: N, comments: M}} 

  // States now linked to video IDs
  const [activeTab, setActiveTab] = useState("home");
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [likes, setLikes] = useState({}); // {videoId: true/false} - Private user state
  const [videoComments, setVideoComments] = useState({}); // {videoId: [{commentId, userId, text, timestamp}]}
  const [chatMessages, setChatMessages] = useState([]); // State for global chat messages
  const [commentInput, setCommentInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [showComments, setShowComments] = useState(false);
  
  // UI states
  const [progress, setProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const chatScrollRef = useRef(null);
  const videoRef = useRef(null);
  const isDesktop = typeof window !== "undefined" ? window.innerWidth > 768 : true;
  
  // --- Custom Swipe/Drag Logic Refs ---
  const inputStart = useRef({ x: 0, y: 0, isDragging: false });
  const SWIPE_THRESHOLD = 50;
  // -------------------------------
  
  const currentVideo = videos[index];

  // --- Utility Functions ---

  const showSystemMessage = (message) => {
    setModalMessage(message);
    setShowModal(true);
    setTimeout(() => setShowModal(false), 2000);
  };

  const handleIndexChange = (newIndex) => {
    // Ensure the index loops correctly
    const nextIndex = (newIndex + filteredVideos.length) % filteredVideos.length;
    // Check for negative index resulting from modulo on negative numbers
    setIndex(nextIndex < 0 ? filteredVideos.length + nextIndex : nextIndex);
    
    // When video changes, ensure comments panel is closed
    setShowComments(false);
  };
  
  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);
  
  
  // --- MERGED SWIPE/DRAG HANDLERS (Touch and Mouse) ---

  const getCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    if (e.clientX !== undefined) {
      return { x: e.clientX, y: e.clientY };
    }
    return null;
  };

  const handleStart = (e) => {
    const coords = getCoordinates(e);
    if (coords) {
      inputStart.current = {
        x: coords.x,
        y: coords.y,
        isDragging: true,
      };
    }
    if (e.type === 'mousedown') {
         e.preventDefault();
    }
  };

  const handleEnd = (e) => {
    if (!inputStart.current.isDragging) return;

    const startX = inputStart.current.x;
    const startY = inputStart.current.y;
    inputStart.current.isDragging = false; 
    
    const coords = getCoordinates(e); 
    if (!coords) return;
    
    const diffX = startX - coords.x;
    const diffY = startY - coords.y; 

    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    if (absDiffY > SWIPE_THRESHOLD && absDiffY > absDiffX) {
      if (diffY > 0) {
        handleIndexChange(index + 1);
      } else {
        handleIndexChange(index - 1);
      }
    }
  };
  
  const handleMove = (e) => {
    if (inputStart.current.isDragging && e.type === 'mousemove') {
        e.preventDefault(); 
    }
  }

  const handleCancel = () => {
    inputStart.current.isDragging = false;
  }
  // --------------------------------------------------------

  // --- 2. FIREBASE AUTHENTICATION & INITIALIZATION ---
  useEffect(() => {
    // Check if services were successfully initialized above
    if (!auth || !db) {
      console.warn("Firebase services not initialized. Running in Read-Only / Demo mode.");
      setUserId(null); 
      setIsAuthReady(true);
      return; 
    }
    
    // Listen for auth state changes using the provided Firebase setup
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in (Google/GitHub/etc.)
        setUserId(user.uid);
      } else {
        // User is signed out
        setUserId(null); 
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [auth, db]); 

  // --- AUTH PROVIDERS AND HANDLERS ---
  const googleProvider = new GoogleAuthProvider();
  const githubProvider = new GithubAuthProvider();

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


  // --- 3. FIRESTORE DATA LISTENERS ---
  
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
  }, [isAuthReady, db]);

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
        // A like is active if 'active' is not explicitly false
        if (data.active !== false) {
           userLikes[doc.id] = true; 
        }
      });
      setLikes(userLikes);
    }, (error) => {
      console.error("Error fetching likes:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, userId, db]);


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
  }, [isAuthReady, db]);
  
  // 3d. Fetch Global Chat Messages (Public Collection)
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const chatRef = collection(db, `artifacts/${appId}/public/data/chatMessages`);
    const q = query(chatRef); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(), // Convert Firebase Timestamp
      }));
      
      // Sort messages by timestamp client-side (ASC)
      fetchedMessages.sort((a, b) => a.timestamp - b.timestamp);

      setChatMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db]);

  // 3e. Fetch Public Video Stats (Likes/Comments Count)
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const statsRef = collection(db, `artifacts/${appId}/public/data/videoStats`);
    const q = query(statsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = {};
      snapshot.docs.forEach(doc => {
        // Ensure that likes and comments are treated as numbers, defaulting to 0
        const data = doc.data();
        stats[doc.id] = {
            likes: data.likes || 0,
            comments: data.comments || 0,
        };
      });
      setVideoStats(stats);
    }, (error) => {
      console.error("Error fetching video stats:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db]);


  // --- 4. FIREBASE Interaction Functions (Using Transactions for Social Counters) ---

  // Like toggle (Writes to Private Collection and updates Public Counter via Transaction)
  const handleLike = async () => {
    if (!db) return showSystemMessage("Data storage is disabled.");
    // GUARD: User must be signed in to perform a social action
    if (!userId) return showSystemMessage("Please sign in to like videos."); 

    const videoId = currentVideo.id;
    const isLiked = likes[videoId];

    // References for the private like status and the public stats counter
    const likeDocRef = doc(db, `artifacts/${appId}/users/${userId}/likes/${videoId}`);
    const statsDocRef = doc(db, `artifacts/${appId}/public/data/videoStats/${videoId}`);
    
    try {
        // Use a transaction to ensure both updates (private status and public count) are atomic
        await runTransaction(db, async (transaction) => {
            // Get the current public stats document
            const statsDoc = await transaction.get(statsDocRef);
            let currentLikes = statsDoc.exists() ? statsDoc.data().likes || 0 : 0;
            
            if (isLiked) {
                // UNLIKE: Update user private status to inactive (false)
                transaction.set(likeDocRef, { active: false }, { merge: true });
                
                // Decrement public count (safely)
                if (currentLikes > 0) {
                    transaction.set(statsDocRef, { likes: currentLikes - 1 }, { merge: true });
                }
                showSystemMessage("Unliked!");
            } else {
                // LIKE: Update user private status to active (true)
                transaction.set(likeDocRef, { active: true, timestamp: serverTimestamp() });
                
                // Increment public count
                transaction.set(statsDocRef, { likes: currentLikes + 1 }, { merge: true });
                showSystemMessage("Liked! 🔥");
            }
        });
    } catch (e) {
        console.error("Error running like transaction:", e);
        showSystemMessage("Error: Could not process like. Please try again.");
    }
  };

  // Add video comment (Writes to Public Collection and updates Public Counter via Transaction)
  const addVideoComment = async () => {
    if (!db) return showSystemMessage("Data storage is disabled.");
    // GUARD: User must be signed in to perform a social action
    if (!userId) return showSystemMessage("Please sign in to post comments.");

    const text = commentInput.trim();
    if (!text) return;
    
    const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
    const statsDocRef = doc(db, `artifacts/${appId}/public/data/videoStats/${currentVideo.id}`);

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Add the comment (using a new doc reference for an auto-generated ID)
            const newCommentRef = doc(commentsCollectionRef); 
            transaction.set(newCommentRef, {
                videoId: currentVideo.id,
                userId: userId,
                text: text,
                timestamp: serverTimestamp(),
            });
            
            // 2. Increment public comment count
            const statsDoc = await transaction.get(statsDocRef);
            let currentCommentsCount = statsDoc.exists() ? statsDoc.data().comments || 0 : 0;
            
            transaction.set(statsDocRef, { comments: currentCommentsCount + 1 }, { merge: true });
        });
        
        setCommentInput("");
        showSystemMessage("Comment posted successfully!");
    } catch (e) {
        console.error("Error adding video comment:", e);
        showSystemMessage("Error: Could not post comment.");
    }
  };
  
  // Add global chat message (Writes to Public Collection)
  const addChatMessage = async () => {
    if (!db) return showSystemMessage("Data storage is disabled.");
    if (!userId) return showSystemMessage("Please sign in to chat globally."); // Check for logged-in user

    const text = chatInput.trim();
    if (!text) return;
    
    const chatRef = collection(db, `artifacts/${appId}/public/data/chatMessages`);

    try {
      await addDoc(chatRef, {
        userId: userId,
        text: text,
        timestamp: serverTimestamp(),
      });
      setChatInput("");
    } catch (e) {
      console.error("Error adding chat message:", e);
      showSystemMessage("Error: Could not send message.");
    }
  };


  // Share (Uses Modal instead of alert)
  const shareVideo = async () => {
    try {
      if (!currentVideo) return;
      const { title } = currentVideo;
      
      // Use the actual URL of the current canvas environment for sharing
      const urlToShare = window.location.href;
      
      if (navigator.share) {
        // Web Share API for mobile/modern browsers
        await navigator.share({ title, text: "Check out this ASA video", url: urlToShare });
      } else {
        // Clipboard fallback logic
        const contentToCopy = `Check out this video: ${title} - ${urlToShare}`;
        
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          // Fallback for older browsers (document.execCommand('copy'))
          const tempInput = document.createElement('input');
          tempInput.value = contentToCopy;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
        } else {
          await navigator.clipboard.writeText(contentToCopy);
        }
        showSystemMessage("Link copied to clipboard! 📋");
      }
    } catch (e) {
      console.error("Share error:", e);
      showSystemMessage("Share failed or was cancelled.");
    }
  };


  // --- Filtered Videos ---
  const filteredVideos = videos.filter(video => 
    video.title.toLowerCase().includes(search.toLowerCase()) || 
    video.desc.toLowerCase().includes(search.toLowerCase())
  );
  
  // Update index if current video is filtered out
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

  const videoToDisplay = filteredVideos.length > 0 ? filteredVideos[index % filteredVideos.length] : null;

  // --- COMPONENTS ---
  
  const SystemModal = () => (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '15px 30px',
        borderRadius: '10px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        fontWeight: 'bold',
        textAlign: 'center',
        opacity: 1,
        transition: 'opacity 0.3s ease-out'
      }}
    >
      {modalMessage}
    </div>
  );

  const Home = () => {
    if (!videoToDisplay) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>Loading videos...</div>;

    const videoId = videoToDisplay.id;
    const currentComments = videoComments[videoId] || [];
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
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseMove={handleMove}
        onMouseLeave={handleCancel}
        
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          backgroundColor: "black",
        }}
        onClick={() => {
          const v = videoRef.current;
          // Only attempt to play if video is paused, to avoid replaying on every tap
          if (v && v.paused) v.play().catch(() => {});
        }}
      >
        <header
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to right, #006400, #FFD700, #8B0000)",
            color: "white",
            padding: "12px 16px",
            fontWeight: "bold",
            zIndex: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
            {/* --- LOGO INTEGRATION START --- */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <img 
                    src="asa-logo.jpg" 
                    alt="ASA Logo" 
                    style={{ 
                        height: '30px', 
                        width: '30px', 
                        borderRadius: '50%', 
                        marginRight: '8px',
                        boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)'
                    }} 
                />
                <span style={{ fontSize: '1.2rem' }}>DASHBOARD</span>
            </div>
            {/* --- LOGO INTEGRATION END --- */}
          <span style={{ fontSize: '0.7rem', fontWeight: 'normal', opacity: 0.8 }}>
             User: {userId ? auth.currentUser?.email || userId.substring(0, 8) + '...' : 'Guest'}
          </span>
        </header>

        <input
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            position: "absolute",
            top: 54,
            left: "50%",
            transform: "translateX(-50%)",
            width: isDesktop ? "55%" : "90%", // Increased width slightly for mobile
            height: "40px", // Increased height slightly
            borderRadius: "8px", // More modern rounded corners
            border: "1px solid #FFD700", // Gold border for accent
            background: "rgba(30, 30, 30, 0.9)", // Dark, slightly transparent background
            padding: "0 15px",
            fontSize: "1rem",
            color: "white", // White text
            outline: "none",
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.3s',
            zIndex: 3,
          }}
        />

        <video
          key={videoToDisplay.id + search} 
          ref={videoRef}
          src={videoToDisplay.src}
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{
            width: isDesktop ? "90%" : "100%",
            height: "100%", 
            objectFit: "cover",
            borderRadius: isDesktop ? "10px" : "0px",
          }}
          onError={() => console.error(`Failed to load video: ${videoToDisplay.src}`)}
        />

        <div
          style={{
            position: "absolute",
            bottom: 160, 
            left: 15,
            right: 100,
            color: "white",
            textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
            zIndex: 4,
          }}
        >
          <h3 style={{ margin: 0 }}>{videoToDisplay.title}</h3>
          <p style={{ margin: "4px 0 0", opacity: 0.9 }}>{videoToDisplay.desc}</p>
        </div>

        <div
          style={{
            position: "absolute",
            right: 15,
            bottom: 180,
            display: "flex",
            flexDirection: "column",
            gap: "25px", 
            color: "white",
            zIndex: 4,
            textShadow: '0 0 5px rgba(0,0,0,0.8)'
          }}
        >
            <button onClick={handleLike} style={{...actionButtonStyle}}>
                <div style={{ 
                    ...iconStyle, 
                    transform: isLiked ? 'scale(1.1)' : 'scale(1.0)',
                    transition: 'transform 0.2s ease-in-out',
                    color: isLiked ? '#FFD700' : 'white',
                    fontWeight: isLiked ? 'bold' : 'normal',
                }}>
                    {isLiked ? "🔥" : "🤍"}
                </div>
                {/* Display total public like count */}
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{likeCount}</span> 
            </button>
            
            <button onClick={() => setShowComments(true)} style={actionButtonStyle}>
                <div style={iconStyle}>
                    💬
                </div>
                {/* Display total public comment count */}
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{commentCount}</span> 
            </button>

            <button onClick={shareVideo} style={actionButtonStyle}>
                <div style={iconStyle}>
                    🔗
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Share</span>
            </button>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 130, 
            left: 0,
            width: `${progress}%`,
            height: "4px",
            background: "#FFD700",
            zIndex: 4,
          }}
        />

        {showComments && (
          <div
            style={{
              position: "absolute",
              bottom: 180, 
              left: 0,
              width: "100%",
              height: "35%", 
              background: "rgba(0,0,0,0.9)",
              backdropFilter: "blur(5px)",
              WebkitBackdropFilter: "blur(5px)",
              borderTopLeftRadius: "18px",
              borderTopRightRadius: "18px",
              padding: "14px",
              color: "white",
              display: "flex",
              flexDirection: "column",
              zIndex: 10,
            }}
          >
            <div
              style={{ textAlign: "center", marginBottom: "10px", cursor: "pointer", fontWeight: 600 }}
              onClick={() => setShowComments(false)}
            >
              ⬇️ Close Comments ({commentCount})
            </div>

            <div style={{ flex: 1, overflowY: "auto", marginBottom: "10px" }}>
              {currentComments.length === 0 ? (
                <div style={{ opacity: 0.7, textAlign: 'center', marginTop: '20px' }}>No comments yet. Be the first!</div>
              ) : (
                currentComments.map((c) => (
                  <div key={c.id} style={{ marginBottom: "12px", background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#FFD700' }}>
                      {/* Show first 8 chars of userId or 'Guest' if null */}
                      {c.userId ? c.userId.substring(0, 8) + '...' : 'Guest'} 
                      <span style={{ fontWeight: 'normal', opacity: 0.7, marginLeft: '10px' }}>
                          {c.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div>{c.text}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", zIndex: 10 }}>
              <input
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
        )}

        <div
          style={{
            position: "absolute",
            bottom: 150, 
            width: "100%",
            textAlign: "center",
            color: "white",
            opacity: 0.8,
            fontSize: "1rem",
            zIndex: 4,
          }}
        >
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
  writeBatch,
  getDoc,
  updateDoc
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
  }, [isAuthReady, db]);

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
  }, [isAuthReady, userId, db]);


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
  }, [isAuthReady, db]);

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
  }, [isAuthReady, db]);


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
  }, [isAuthReady, db]);


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
    if (!userId || !commentInput.trim() || !db || !currentVideo) return;

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


  // --- 5. UI LOGIC & HELPERS ---

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);
  
  // Filter videos based on search term
  const filteredVideos = videos.filter(video => 
    video.title?.toLowerCase().includes(search.toLowerCase()) || 
    video.description?.toLowerCase().includes(search.toLowerCase()) ||
    video.category?.toLowerCase().includes(search.toLowerCase())
  );
  
  const currentVideo = filteredVideos.length > 0 ? filteredVideos[index % filteredVideos.length] : null;

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

  const videoToDisplay = filteredVideos.length > 0 ? filteredVideos[index % filteredVideos.length] : null;

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
    if (!videoToDisplay) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>Loading videos...</div>;

    const videoId = videoToDisplay.id;
    const currentComments = videoComments[videoId] || [];
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
          src={`${videoToDisplay.url}?autoplay=1&loop=1&title=0&byline=0&portrait=0`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          title={videoToDisplay.title}
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
            {videoToDisplay.title}
          </h1>
          <p style={{ fontSize: "1rem", margin: "5px 0 0" }}>
            {videoToDisplay.description}
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
            #{videoToDisplay.category}
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
    const videoId = videoToDisplay?.id;
    const currentComments = videoComments[videoId] || [];

    return (
        <div style={{ padding: 20, color: "white", background: "#111", flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#FFD700', margin: '0 0 15px' }}>💬 Comments for "{videoToDisplay.title}"</h2>
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
