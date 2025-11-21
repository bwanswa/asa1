import React, { useState, useEffect, useRef } from "react";
// Removed: import { useSwipeable } from "react-swipeable";

// ---------------------------
// VIDEO LIST
// ---------------------------
const videos = [
  { src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Introduction" },
  { src: "https://www.w3schools.com/html/movie.mp4", title: "Unity Message" },
  { src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Community Highlights" },
];

// Dashboard now accepts a prop to handle the actual logout action in the parent App component
const Dashboard = ({ setIsLoggedIn }) => {
  const [activeTab, setActiveTab] = useState("home");
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState("");
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);
  const touchStartRef = useRef(0);
  const touchEndRef = useRef(0);
  const minSwipeDistance = 50; // Minimum pixels for a recognized swipe

  const nextVideo = () => {
    setIndex((i) => (i + 1) % videos.length);
    setProgress(0);
  };

  const prevVideo = () => {
    setIndex((i) => (i - 1 + videos.length) % videos.length);
    setProgress(0);
  };

  // ---------------------------
  // NATIVE SWIPE IMPLEMENTATION (Replacing react-swipeable)
  // ---------------------------
  const handleTouchStart = (e) => {
    // Record the starting X position of the touch
    touchEndRef.current = 0; // Reset end position
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    // Record the current X position of the touch
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const isHorizontalSwipe = Math.abs(distance) > minSwipeDistance;

    if (isHorizontalSwipe) {
      if (distance > 0) {
        // Swiped Left (distance is positive) -> Next video
        nextVideo();
      } else {
        // Swiped Right (distance is negative) -> Previous video
        prevVideo();
      }
    }
    // Reset positions
    touchStartRef.current = 0;
    touchEndRef.current = 0;
  };

  // ---------------------------
  // AUTO-SWIPE WHEN VIDEO ENDS
  // ---------------------------
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      const handler = () => nextVideo();
      v.addEventListener("ended", handler);
      return () => v.removeEventListener("ended", handler);
    }
  }, [index]);

  // ---------------------------
  // PROGRESS BAR
  // ---------------------------
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener("timeupdate", update);
    return () => v.removeEventListener("timeupdate", update);
  }, [index]);

  // ---------------------------
  // LIKE
  // ---------------------------
  const handleLike = () => {
    if (likes[index]) return;
    setLikes((prev) => ({ ...prev, [index]: true }));

    // Visual feedback for like (Heart animation)
    const heart = document.createElement("div");
    heart.innerHTML = "🔥❤️";
    heart.style.position = "absolute";
    heart.style.top = "50%";
    heart.style.left = "50%";
    heart.style.transform = "translate(-50%, -50%) scale(2)";
    heart.style.color = "white";
    heart.style.fontSize = "3rem";
    heart.style.opacity = "1";
    heart.style.transition = "opacity 1s, transform 1s";
    // Using videoRef.current.parentElement to safely target the wrapper
    videoRef.current?.parentElement?.appendChild(heart); 

    setTimeout(() => {
      heart.style.opacity = "0";
      heart.style.transform = "translate(-50%, -70%) scale(1)";
    }, 100);
    setTimeout(() => heart.remove(), 1000);
  };

  // ---------------------------
  // COMMENTS
  // ---------------------------
  const addComment = () => {
    if (!commentInput.trim()) return;
    setComments((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), commentInput],
    }));
    setCommentInput("");
  };

  // ---------------------------
  // SHARE
  // ---------------------------
  const shareVideo = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "ASA Video",
          text: videos[index].title,
          url: videos[index].src,
        });
      } else {
        // Fallback for sharing (copied to clipboard, using execCommand instead of navigator.clipboard)
        document.execCommand('copy', false, videos[index].src);
        console.log("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  // ---------------------------
  // LOGOUT (UPDATED)
  // ---------------------------
  const handleLogout = () => {
    // This calls the state setter passed from the parent App component
    console.log("User successfully triggered logout.");
    if (setIsLoggedIn) {
        setIsLoggedIn(false); 
    }
  };

  // ---------------------------
  // HOME PAGE
  // ---------------------------
  const HomePage = () => (
    <div
      id="video-wrapper"
      // Added stopPropagation to onClick to prevent accidental liks when user interacts with the container
      onClick={(e) => e.stopPropagation()} 
      onTouchStart={handleTouchStart} // Native swipe events added here
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: "relative", height: "100%", width: "100%", background: "black", touchAction: 'pan-y' }}
    >
      <video
        ref={videoRef}
        key={index}
        src={videos[index].src}
        autoPlay
        loop={false}
        controls={false}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Video Title and Navigation Helpers */}
      <div style={{ position: "absolute", top: 20, left: 20, color: "white", fontSize: "1.2rem", fontWeight: "bold", textShadow: "0 0 5px black" }}>
        {videos[index].title}
      </div>

      {/* Action Buttons (Like, Comment, Share) */}
      <div style={{ position: "absolute", right: 15, bottom: 120, display: "flex", flexDirection: "column", gap: "20px", color: "white", fontSize: "2rem" }}>
        {/* Like Button */}
        <div onClick={(e) => { e.stopPropagation(); handleLike(); }} style={{ cursor: "pointer" }}>{likes[index] ? "🔥❤️" : "🤍"}</div>
        {/* Comment Button */}
        <div onClick={(e) => { e.stopPropagation(); setShowComments(true); }} style={{ cursor: "pointer" }}>💬</div>
        {/* Share Button */}
        <div onClick={(e) => { e.stopPropagation(); shareVideo(); }} style={{ cursor: "pointer" }}>🔗</div>
      </div>

      {/* Progress Bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: `${progress}%`, height: "5px", background: "#FFD700" }} />

      {/* Comments Drawer */}
      {showComments && (
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent closing/liking the video when interacting with comments
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%", background: "rgba(0,0,0,0.9)", backdropFilter: "blur(5px)", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "15px", color: "white", display: "flex", flexDirection: "column" }}
        >
          <div style={{ textAlign: "center", marginBottom: "10px", fontWeight: "bold" }} onClick={() => setShowComments(false)} className="cursor-pointer">⬇️ Close</div>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: "10px", padding: "0 10px" }}>
            {(comments[index] || []).map((c, i) => (<div key={i} style={{ marginBottom: "8px", background: "rgba(255,255,255,0.1)", padding: "5px 10px", borderRadius: "8px" }}>{c}</div>))}
            {comments[index]?.length === 0 && <div style={{ textAlign: 'center', opacity: 0.7 }}>Be the first to comment!</div>}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              value={commentInput} 
              onChange={(e) => setCommentInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }}
              placeholder="Add a comment…" 
              style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", color: "black" }} 
            />
            <button onClick={addComment} style={{ background: "#FFD700", border: "none", borderRadius: "10px", padding: "10px 15px", color: "black", fontWeight: "bold", cursor: "pointer" }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );

  // ---------------------------
  // PAGE SWITCHING
  // ---------------------------
  const renderContent = () => {
    if (activeTab === "home") return <HomePage />;
    if (activeTab === "chats") return <div style={{ padding: 20, color: 'white' }}><h2>💬 Chats</h2><p>Messages and real-time communication go here.</p></div>;
    if (activeTab === "profile") return <div style={{ padding: 20, color: 'white' }}><h2>👤 Profile</h2><p>User settings and account information.</p></div>;
  };

  const navButton = (tabName, icon, label) => (
    <button
      onClick={() => setActiveTab(tabName)}
      style={{
        background: 'none',
        border: 'none',
        color: activeTab === tabName ? '#FFD700' : 'white',
        fontWeight: activeTab === tabName ? 'bold' : 'normal',
        cursor: 'pointer',
        padding: '5px 10px',
        fontSize: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        transition: 'color 0.2s'
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
      {/* HEADER with Logout Button */}
      <header style={{ 
        background: "linear-gradient(to right,#006400,#FFD700,#8B0000)", 
        color: "white", 
        padding: "15px 20px", 
        fontWeight: "bold",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10 // Ensure header is above main content
      }}>
        <span>ASA Dashboard</span>
        
        {/* LOGOUT BUTTON */}
        <button
          onClick={handleLogout}
          style={{
            background: "#8B0000",
            color: "white",
            border: "2px solid white",
            borderRadius: "9999px", // Fully rounded
            padding: "5px 15px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "0.85rem",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            transition: "background 0.2s, transform 0.1s",
          }}
          // Basic hover/active effects
          onMouseOver={(e) => e.target.style.background = "#A52A2A"}
          onMouseOut={(e) => e.target.style.background = "#8B0000"}
          onMouseDown={(e) => e.target.style.transform = "scale(0.98)"}
          onMouseUp={(e) => e.target.style.transform = "scale(1)"}
        >
          Logout
        </button>

      </header>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {renderContent()}
      </main>

      {/* NAVIGATION BAR */}
      <nav style={{ 
        background: "linear-gradient(to right,#006400,#FFD700,#8B0000)", 
        display: "flex", 
        justifyContent: "space-around", 
        padding: "5px 0 10px 0", 
        position: "fixed", 
        bottom: 0, 
        width: "100%", 
        color: "white",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.5)",
        zIndex: 10 
      }}>
        {navButton("home", "🎬", "Home")}
        {navButton("chats", "💬", "Chats")}
        {navButton("profile", "👤", "Profile")}
      </nav>
      {/* Spacer div to prevent content from being hidden by fixed nav bar */}
      <div style={{ height: '60px' }}></div> 
    </div>
  );
};

// Main App Component (UPDATED to handle login state)
const App = () => {
    // New state to manage the logged-in status
    const [isLoggedIn, setIsLoggedIn] = useState(true);

    const handleLogin = () => {
        console.log("User successfully performed mock login.");
        setIsLoggedIn(true);
    };

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            {isLoggedIn ? (
                // If logged in, show the Dashboard and pass the setter function
                <Dashboard setIsLoggedIn={setIsLoggedIn} /> 
            ) : (
                // If logged out, show a mock login screen
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#000', color: 'white', padding: '20px' }}>
                    <h1 style={{ marginBottom: '20px', color: '#FFD700', fontSize: '2rem' }}>👋 Logged Out</h1>
                    <p style={{ marginBottom: '30px', textAlign: 'center' }}>You have been successfully logged out of the ASA Dashboard.</p>
                    <button
                        onClick={handleLogin}
                        style={{
                            background: "#006400",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            padding: "10px 30px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "1rem",
                            boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                            transition: "background 0.2s, transform 0.1s",
                        }}
                    >
                        Log In
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;
