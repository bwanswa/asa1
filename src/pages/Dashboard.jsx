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
//logout
               <p>
    <button 
      onClick={() => {
        auth.signOut()
          .then(() => {
            // Redirect to login page after successful logout
            window.location.href = "/Login.jsx"; 
          })
          .catch((error) => {
            console.error("Logout error:", error);
          });
      }}
      style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
    >
      Logout
    </button>
  </p>
              //end logout
              
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
          👆 Drag up/down or swipe to watch next
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
                  background: msg.userId === userId ? '#006400' : 'rgba(255,255,255,0.1)',
                  padding: '10px 15px',
                  borderRadius: '15px',
                  borderTopRightRadius: msg.userId === userId ? '4px' : '15px',
                  borderTopLeftRadius: msg.userId === userId ? '15px' : '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: msg.userId === userId ? '#FFD700' : '#8B0000', marginBottom: '4px' }}>
                  {msg.userId === userId ? 'You' : `User: ${msg.userId.substring(0, 8)}...`} 
                  <span style={{ fontWeight: 'normal', opacity: 0.7, marginLeft: '10px', color: 'white' }}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>{msg.text}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", paddingBottom: '10px' }}>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addChatMessage(); }}
          placeholder={userId ? "Send a global message..." : "Sign in to chat..."}
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
          onClick={addChatMessage}
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
  
  // Helper style for auth buttons
  const authButtonStyle = (backgroundColor) => ({
      padding: '10px 15px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 'bold',
      color: 'white',
      cursor: 'pointer',
      background: backgroundColor,
      transition: 'opacity 0.2s',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
  });


  const Profile = () => {
    const totalLikes = Object.values(likes).filter(Boolean).length;
    const totalChatMessages = chatMessages.length;
    const currentEmail = auth.currentUser?.email;

    return (
      <div style={{ padding: 20, color: "white", background: "#111", flex: 1, overflowY: 'auto' }}>
        <h2>👤 Profile</h2>
        {isAuthReady ? (
            <div style={{marginBottom: '20px', padding: '15px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px'}}>
                {userId ? (
                    <>
                        <h3 style={{color: '#FFD700', marginTop: 0}}>Status: Logged In</h3>
                        {currentEmail && <p>Email: <span style={{ color: '#FFD700', wordBreak: 'break-all' }}>{currentEmail}</span></p>}
                        <p>User ID: <span style={{ color: '#FFD700', fontWeight: 'bold', wordBreak: 'break-all' }}>{userId}</span></p>
                        <button
                            onClick={handleLogout}
                            style={authButtonStyle('#8B0000')}
                        >
                            Log Out
                        </button>
                    </>
                ) : (
                    <>
                        <h3 style={{color: '#8B0000', marginTop: 0}}>Status: Logged Out</h3>
                        <p>Sign in to post comments, chat, and persist likes.</p>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            <button
                                onClick={signInWithGoogle}
                                style={authButtonStyle('#4285F4')}
                            >
                                <span style={{fontSize: '1.2rem', marginRight: '10px'}}>G</span> Sign In with Google
                            </button>
                            <button
                                onClick={signInWithGithub}
                                style={authButtonStyle('#333')}
                            >
                                <span style={{fontSize: '1.2rem', marginRight: '10px'}}>&#9733;</span> Sign In with GitHub
                            </button>
                        </div>
                    </>
                )}
                {/* Other stats... */}
                <h3 style={{color: '#FFD700', marginTop: '30px'}}>Activity Summary (Private Data)</h3>
                <p>Total Videos: {videos.length}</p>
                <p>Your Total Likes: {totalLikes}</p>
                <p>Your Total Chat Messages: {totalChatMessages}</p>
                <p>App ID: {appId}</p>
            </div>
        ) : (
            <div style={{ color: '#aaa' }}>Loading authentication status...</div>
        )}
      </div>
    );
  };

  const Events = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1 }}>
      <h2>🎉 Events</h2>
      <p>Upcoming events will appear here. This data can also be loaded from a public Firestore collection!</p>
    </div>
  );

  const renderContent = () => {
    if (!isAuthReady) {
        return (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                <p>Initializing App and Authentication...</p>
            </div>
        );
    }
    
    switch (activeTab) {
      case "home":
        return <Home />;
      case "chats":
        return <Chats />;
      case "profile":
        return <Profile />;
      case "events":
        return <Events />;
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
      <div style={{ flex: 1 }}>{renderContent()}</div>
      {showModal && <SystemModal />}

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
        <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", opacity: activeTab === 'home' ? 1 : 0.7 }}>
          🎬 Home
        </div>
        <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer", opacity: activeTab === 'chats' ? 1 : 0.7 }}>
          💬 Chats
        </div>
        <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", opacity: activeTab === 'profile' ? 1 : 0.7 }}>
          👤 Profile
        </div>
        <div onClick={() => setActiveTab("events")} style={{ cursor: "pointer", opacity: activeTab === 'events' ? 1 : 0.7 }}>
          🎉 Events
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
