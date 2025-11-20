// src/components/LogoutButton.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function LogoutButton({ onLogout, className, style }) {
  const navigate = useNavigate();

  const handleClick = async () => {
    try {
      if (typeof onLogout === "function") await onLogout();

      try { localStorage.removeItem("authToken"); } catch (e) {}
      try { sessionStorage.removeItem("authToken"); } catch (e) {}
      document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";

      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      navigate("/login");
    }
  };

  return (
    <button
      type="button"
      aria-label="Logout"
      onClick={handleClick}
      className={className || "logout-button"}
      style={style}
    >
      Logout
    </button>
  );
}
// src/pages/Dashboard.jsx
/* global __app_id */
import React, { useState, useRef, useEffect } from "react";
import LogoutButton from "../components/LogoutButton";

// FIREBASE IMPORTS
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  addDoc,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";

// App ID sanitization
const rawAppId = typeof __app_id !== "undefined" ? __app_id : "vercel-local-dev";
const appId = rawAppId.split(/[\/\-]/)[0];

// Firebase config (as provided)
const customFirebaseConfig = {
  apiKey: "AIzaSyBRyHQf2IWzPoOrm8UsgcdJvDIxEQR2G40",
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

// Initial videos
const INITIAL_VIDEOS = [
  { id: "v1", src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Global Initiative", desc: "Connecting the world" },
  { id: "v2", src: "https://www.w3schools.com/html/movie.mp4", title: "Future of Digital Learning", desc: "Exploring emerging technologies" },
  { id: "v3", src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Volunteer Spotlight Series", desc: "Making a difference in communities" },
];

const Dashboard = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [videos, setVideos] = useState(INITIAL_VIDEOS);
  const [videoStats, setVideoStats] = useState({});
  const [activeTab, setActiveTab] = useState("home");
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [likes, setLikes] = useState({});
  const [videoComments, setVideoComments] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const chatScrollRef = useRef(null);
  const videoRef = useRef(null);

  const inputStart = useRef({ x: 0, y: 0, isDragging: false });
  const SWIPE_THRESHOLD = 50;

  const currentVideo = videos[index];
  // Utilities
  const showSystemMessage = (message) => {
    setModalMessage(message);
    setShowModal(true);
    setTimeout(() => setShowModal(false), 2000);
  };

  const getCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    if (e.clientX !== undefined) return { x: e.clientX, y: e.clientY };
    return null;
  };

  const handleStart = (e) => {
    const coords = getCoordinates(e);
    if (coords) inputStart.current = { x: coords.x, y: coords.y, isDragging: true };
    if (e.type === "mousedown") e.preventDefault();
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
      handleIndexChange(diffY > 0 ? index + 1 : index - 1);
    }
  };

  const handleMove = (e) => {
    if (inputStart.current.isDragging && e.type === "mousemove") e.preventDefault();
  };

  const handleCancel = () => { inputStart.current.isDragging = false; };

  // AUTH LISTENER
  useEffect(() => {
    if (!auth || !db) {
      console.warn("Firebase services not initialized. Running in Read-Only / Demo mode.");
      setUserId(null);
      setIsAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const googleProvider = new GoogleAuthProvider();
  const githubProvider = new GithubAuthProvider();

  const signInWithGoogle = async () => {
    if (!auth) return showSystemMessage("Authentication not available.");
    try { await signInWithPopup(auth, googleProvider); showSystemMessage("Signed in with Google successfully!"); }
    catch (err) { console.error(err); showSystemMessage(`Sign-in failed: ${err.message.substring(0,50)}...`); }
  };

  const signInWithGithub = async () => {
    if (!auth) return showSystemMessage("Authentication not available.");
    try { await signInWithPopup(auth, githubProvider); showSystemMessage("Signed in with GitHub successfully!"); }
    catch (err) { console.error(err); showSystemMessage(`Sign-in failed: ${err.message.substring(0,50)}...`); }
  };

  const handleLogout = async () => {
    if (!auth) return showSystemMessage("Authentication not available.");
    try {
      await signOut(auth);
      showSystemMessage("Logged out successfully.");
    } catch (err) {
      console.error(err);
      showSystemMessage("Logout failed.");
    }
  };

  // Firestore listeners (videos, likes, comments, chat, stats)
  useEffect(() => {
    if (!isAuthReady || !db) return;
    const videosRef = collection(db, `artifacts/${appId}/public/data/videos`);
    const unsubscribe = onSnapshot(videosRef, (snapshot) => {
      if (snapshot.empty && videos.length === INITIAL_VIDEOS.length) {
        INITIAL_VIDEOS.forEach(video => {
          setDoc(doc(videosRef, video.id), { ...video, timestamp: serverTimestamp() }).catch(e => console.error("Error seeding video:", e));
        });
        setVideos(INITIAL_VIDEOS);
        return;
      }
      const fetchedVideos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      if (fetchedVideos.length > 0) setVideos(fetchedVideos);
    }, (error) => console.error("Error fetching videos:", error));
    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !userId || !db) { setLikes({}); return; }
    const likesRef = collection(db, `artifacts/${appId}/users/${userId}/likes`);
    const unsubscribe = onSnapshot(likesRef, (snapshot) => {
      const userLikes = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.active !== false) userLikes[d.id] = true;
      });
      setLikes(userLikes);
    }, (error) => console.error("Error fetching likes:", error));
    return () => unsubscribe();
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    const commentsRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
    const q = query(commentsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allComments = {};
      snapshot.docs.forEach(d => {
        const commentData = d.data();
        const videoId = commentData.videoId;
        if (!videoId) return;
        if (!allComments[videoId]) allComments[videoId] = [];
        allComments[videoId].push({
          id: d.id,
          text: commentData.text,
          userId: commentData.userId,
          timestamp: commentData.timestamp?.toDate() || new Date(),
        });
      });
      Object.keys(allComments).forEach(vid => {
        allComments[vid].sort((a,b) => a.timestamp - b.timestamp);
      });
      setVideoComments(allComments);
    }, (error) => console.error("Error fetching comments:", error));
    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    const chatRef = collection(db, `artifacts/${appId}/public/data/chatMessages`);
    const q = query(chatRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate() || new Date()
      }));
      fetchedMessages.sort((a,b) => a.timestamp - b.timestamp);
      setChatMessages(fetchedMessages);
    }, (error) => console.error("Error fetching chat messages:", error));
    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    const statsRef = collection(db, `artifacts/${appId}/public/data/videoStats`);
    const q = query(statsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        stats[d.id] = { likes: data.likes || 0, comments: data.comments || 0 };
      });
      setVideoStats(stats);
    }, (error) => console.error("Error fetching video stats:", error));
    return () => unsubscribe();
  }, [isAuthReady]);

  // Social interactions
  const handleLike = async () => {
    if (!db) return showSystemMessage("Data storage is disabled.");
    if (!userId) return showSystemMessage("Please sign in to like videos.");
    const videoId = currentVideo.id;
    const isLiked = likes[videoId];
    const likeDocRef = doc(db, `artifacts/${appId}/users/${userId}/likes/${videoId}`);
    const statsDocRef = doc(db, `artifacts/${appId}/public/data/videoStats/${videoId}`);
    try {
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsDocRef);
        let currentLikes = statsDoc.exists() ? statsDoc.data().likes || 0 : 0;
        if (isLiked) {
          transaction.set(likeDocRef, { active: false }, { merge: true });
          if (currentLikes > 0) transaction.set(statsDocRef, { likes: currentLikes - 1 }, { merge: true });
          showSystemMessage("Unliked!");
        } else {
          transaction.set(likeDocRef, { active: true, timestamp: serverTimestamp() });
          transaction.set(statsDocRef, { likes: currentLikes + 1 }, { merge: true });
          showSystemMessage("Liked! 🔥");
        }
      });
    } catch (e) {
      console.error("Error running like transaction:", e);
      showSystemMessage("Error: Could not process like. Please try again.");
    }
  };

  const addVideoComment = async () => {
    if (!db) return showSystemMessage("Data storage is disabled.");
    if (!userId) return showSystemMessage("Please sign in to post comments.");
    const text = commentInput.trim();
    if (!text) return;
    const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
    const statsDocRef = doc(db, `artifacts/${appId}/public/data/videoStats/${currentVideo.id}`);
    try {
      await runTransaction(db, async (transaction) => {
        const newCommentRef = doc(commentsCollectionRef);
        transaction.set(newCommentRef, {
          videoId: currentVideo.id,
          userId: userId,
          text: text,
          timestamp: serverTimestamp(),
        });
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

  const addChatMessage = async () => {
    if (!db) return showSystemMessage("Data storage is disabled.");
    if (!userId) return showSystemMessage("Please sign in to chat globally.");
    const text = chatInput.trim();
    if (!text) return;
    const chatRef = collection(db, `artifacts/${appId}/public/data/chatMessages`);
    try {
      await addDoc(chatRef, { userId: userId, text: text, timestamp: serverTimestamp() });
      setChatInput("");
    } catch (e) {
      console.error("Error adding chat message:", e);
      showSystemMessage("Error: Could not send message.");
    }
  };

  // Index change helper
  const handleIndexChange = (newIndex) => {
    const nextIndex = (newIndex + filteredVideos.length) % filteredVideos.length;
    setIndex(nextIndex < 0 ? filteredVideos.length + nextIndex : nextIndex);
    setShowComments(false);
  };

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, activeTab]);

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(search.toLowerCase()) ||
    video.desc.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (filteredVideos.length > 0) {
      const exists = filteredVideos.some(v => v.id === currentVideo?.id);
      if (!exists) setIndex(0);
    }
  }, [search, filteredVideos.length, currentVideo]);
  // UI subcomponents
  const SystemModal = () => (
    <div style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      backgroundColor: "rgba(0,0,0,0.85)", color: "white", padding: "15px 30px",
      borderRadius: "10px", zIndex: 100, fontWeight: "bold", textAlign: "center"
    }}>{modalMessage}</div>
  );

  const Home = () => {
    const videoToDisplay = filteredVideos.length > 0 ? filteredVideos[index % filteredVideos.length] : null;
    const commentCount = videoStats[videoToDisplay?.id]?.comments || 0;
    const likeCount = videoStats[videoToDisplay?.id]?.likes || 0;
    const currentComments = videoComments[videoToDisplay?.id] || [];

    const actionButtonStyle = { display: "flex", gap: 8, alignItems: "center", background: "transparent", border: "none", color: "white", cursor: "pointer" };
    const iconStyle = { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)" };

    if (!videoToDisplay) return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
        <p>No videos available.</p>
      </div>
    );

    return (
      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          onTouchStart={handleStart}
          onTouchEnd={handleEnd}
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onMouseMove={handleMove}
          onMouseLeave={handleCancel}
          style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <video
            ref={videoRef}
            src={videoToDisplay.src}
            style={{ width: "100%", maxHeight: "85vh", objectFit: "cover", background: "black" }}
            controls={false}
            autoPlay
            muted
            loop
          />
          {/* Top-right logout button */}
          <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8, alignItems: "center", zIndex: 60 }}>
            <LogoutButton onLogout={handleLogout} style={{ background: "#FFD700", border: "none", padding: "8px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer", color: "black", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
          </div>

          {/* Right-side actions */}
          <div style={{ position: "absolute", right: 12, bottom: 220, display: "flex", flexDirection: "column", gap: 12, zIndex: 20 }}>
            <button onClick={handleLike} style={actionButtonStyle}>
              <div style={iconStyle}>❤️</div>
              <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>{likeCount}</span>
            </button>

            <button onClick={() => setShowComments(true)} style={actionButtonStyle}>
              <div style={iconStyle}>💬</div>
              <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>{commentCount}</span>
            </button>

            <button onClick={async () => {
              try {
                const title = videoToDisplay.title;
                const urlToShare = window.location.href;
                if (navigator.share) await navigator.share({ title, text: "Check out this ASA video", url: urlToShare });
                else {
                  const contentToCopy = `Check out this video: ${title} - ${urlToShare}`;
                  if (!navigator.clipboard || !navigator.clipboard.writeText) {
                    const tempInput = document.createElement('input');
                    tempInput.value = contentToCopy; document.body.appendChild(tempInput); tempInput.select();
                    document.execCommand('copy'); document.body.removeChild(tempInput);
                  } else await navigator.clipboard.writeText(contentToCopy);
                  showSystemMessage("Link copied to clipboard! 📋");
                }
              } catch (e) { console.error("Share error:", e); showSystemMessage("Share failed or was cancelled."); }
            }} style={actionButtonStyle}>
              <div style={iconStyle}>🔗</div>
              <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>Share</span>
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ position: "absolute", bottom: 130, left: 0, width: `${progress}%`, height: "4px", background: "#FFD700", zIndex: 4 }} />

          {/* Comments panel */}
          {showComments && (
            <div style={{ position: "absolute", bottom: 180, left: 0, width: "100%", height: "35%", background: "rgba(0,0,0,0.9)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", borderTopLeftRadius: "18px", borderTopRightRadius: "18px", padding: "14px", color: "white", display: "flex", flexDirection: "column", zIndex: 10 }}>
              <div style={{ textAlign: "center", marginBottom: "10px", cursor: "pointer", fontWeight: 600 }} onClick={() => setShowComments(false)}>⬇️ Close Comments ({commentCount})</div>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "10px" }}>
                {currentComments.length === 0 ? (
                  <div style={{ opacity: 0.7, textAlign: 'center', marginTop: '20px' }}>No comments yet. Be the first!</div>
                ) : (
                  currentComments.map((c) => (
                    <div key={c.id} style={{ marginBottom: "12px", background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#FFD700' }}>
                        {c.userId ? c.userId.substring(0, 8) + '...' : 'Guest'}
                        <span style={{ fontWeight: 'normal', opacity: 0.7, marginLeft: '10px' }}>{c.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <div>{c.text}</div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: "flex", gap: "10px", zIndex: 10 }}>
                <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder={userId ? "Add a comment…" : "Sign in to comment..."} disabled={!userId} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.4)", background: userId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)", color: "black", fontSize: "0.95rem", outline: "none" }} />
                <button onClick={addVideoComment} disabled={!commentInput.trim() || !userId} style={{ background: (!commentInput.trim() || !userId) ? "#aaa" : "#FFD700", border: "none", borderRadius: "10px", padding: "12px 16px", color: "black", fontWeight: "bold", cursor: "pointer", transition: 'background 0.3s' }}>Send</button>
              </div>
            </div>
          )}

          <div style={{ position: "absolute", bottom: 150, width: "100%", textAlign: "center", color: "white", opacity: 0.8, fontSize: "1rem", zIndex: 4 }}>
            <div style={{ fontWeight: 700 }}>{videoToDisplay.title}</div>
            <div style={{ opacity: 0.9 }}>{videoToDisplay.desc}</div>
          </div>
        </div>
      </div>
    );
  };

  const Chats = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ color: '#FFD700', margin: '0 0 15px' }}>💬 Global Chat</h2>
      <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', paddingRight: '10px', maxHeight: 'calc(100vh - 250px)' }}>
        {chatMessages.length === 0 ? (
          <div style={{ opacity: 0.7, textAlign: 'center', marginTop: '20px' }}>Start the conversation!</div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: "12px", display: 'flex', justifyContent: msg.userId === userId ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', background: msg.userId === userId ? '#006400' : 'rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '15px', borderTopRightRadius: msg.userId === userId ? '4px' : '15px', borderTopLeftRadius: msg.userId === userId ? '15px' : '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: msg.userId === userId ? '#FFD700' : '#8B0000', marginBottom: '4px' }}>
                  {msg.userId === userId ? 'You' : `User: ${msg.userId.substring(0, 8)}...`}
                  <span style={{ fontWeight: 'normal', opacity: 0.7, marginLeft: '10px', color: 'white' }}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div>{msg.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: "10px", paddingBottom: '10px' }}>
        <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChatMessage(); }} placeholder={userId ? "Send a global message..." : "Sign in to chat..."} disabled={!userId} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.4)", background: userId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)", color: "black", fontSize: "0.95rem", outline: "none" }} />
        <button onClick={addChatMessage} disabled={!chatInput.trim() || !userId} style={{ background: (!chatInput.trim() || !userId) ? "#aaa" : "#FFD700", border: "none", borderRadius: "10px", padding: "12px 16px", color: "black", fontWeight: "bold", cursor: "pointer", transition: 'background 0.3s' }}>Send</button>
      </div>
    </div>
  );

  const authButtonStyle = (backgroundColor) => ({
    padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', color: 'white', cursor: 'pointer', background: backgroundColor, transition: 'opacity 0.2s', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
  });

  const Profile = () => {
    const totalLikes = Object.values(likes).filter(Boolean).length;
    const totalChatMessages = chatMessages.length;
    const currentEmail = auth?.currentUser?.email;
    return (
      <div style={{ padding: 20, color: "white", background: "#111", flex: 1, overflowY: 'auto' }}>
        <h2>👤 Profile</h2>
        {isAuthReady ? (
          <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
            {userId ? (
              <>
                <h3 style={{ color: '#FFD700', marginTop: 0 }}>Status: Logged In</h3>
                {currentEmail && <p>Email: <span style={{ color: '#FFD700', wordBreak: 'break-all' }}>{currentEmail}</span></p>}
                <p>User ID: <span style={{ color: '#FFD700', fontWeight: 'bold', wordBreak: 'break-all' }}>{userId}</span></p>
                <LogoutButton onLogout={handleLogout} style={{ ...authButtonStyle('#8B0000'), color: 'white', background: '#8B0000' }} />
              </>
            ) : (
              <>
                <h3 style={{ color: '#8B0000', marginTop: 0 }}>Status: Logged Out</h3>
                <p>Sign in to post comments, chat, and persist likes.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={signInWithGoogle} style={authButtonStyle('#4285F4')}><span style={{ fontSize: '1.2rem', marginRight: '10px' }}>G</span> Sign In with Google</button>
                  <button onClick={signInWithGithub} style={authButtonStyle('#333')}><span style={{ fontSize: '1.2rem', marginRight: '10px' }}>&#9733;</span> Sign In with GitHub</button>
                </div>
              </>
            )}
            <h3 style={{ color: '#FFD700', marginTop: '30px' }}>Activity Summary (Private Data)</h3>
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
    if (!isAuthReady) return (<div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}><p>Initializing App and Authentication...</p></div>);
    switch (activeTab) {
      case "home": return <Home />;
      case "chats": return <Chats />;
      case "profile": return <Profile />;
      case "events": return <Events />;
      default: return null;
    }
  };

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "black", fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1 }}>{renderContent()}</div>
      {showModal && <SystemModal />}
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", background: "linear-gradient(to right, #006400, #FFD700, #8B0000)", color: "white", padding: "10px 0", position: "fixed", bottom: 0, width: "100%", fontWeight: "600", fontSize: "0.9rem", zIndex: 10 }}>
        <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", opacity: activeTab === 'home' ? 1 : 0.7 }}>🎬 Home</div>
        <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer", opacity: activeTab === 'chats' ? 1 : 0.7 }}>💬 Chats</div>
        <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", opacity: activeTab === 'profile' ? 1 : 0.7 }}>👤 Profile</div>
        <div onClick={() => setActiveTab("events")} style={{ cursor: "pointer", opacity: activeTab === 'events' ? 1 : 0.7 }}>🎉 Events</div>
      </div>
    </div>
  );
};

export default Dashboard;
tha
