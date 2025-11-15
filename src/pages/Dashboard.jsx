import React, { useState, useRef, useEffect } from "react";
import { useSwipeable } from "react-swipeable";

// Videos with info
const videos = [
  { src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Introduction", desc: "Empowering Africa" },
  { src: "https://www.w3schools.com/html/movie.mp4", title: "Unity Message", desc: "Together we rise" },
  { src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Community Highlights", desc: "Celebrating ASA moments" },
];

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [likes, setLikes] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState("");
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);
  const isDesktop = typeof window !== "undefined" ? window.innerWidth > 768 : true;

  // Swipe left/right navigation
  const handlers = useSwipeable({
    onSwipedLeft: () => setIndex((prev) => (prev + 1) % videos.length),
    onSwipedRight: () => setIndex((prev) => (prev - 1 + videos.length) % videos.length),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  // Progress bar update
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener("timeupdate", update);
    return () => v.removeEventListener("timeupdate", update);
  }, [index]);

  // Like toggle
  const handleLike = () => {
    setLikes((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Add comment
  const addComment = () => {
    const text = commentInput.trim();
    if (!text) return;
    setComments((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), text],
    }));
    setCommentInput("");
  };

  // Share
  const shareVideo = async () => {
    try {
      const { title, src } = videos[index];
      if (navigator.share) {
        await navigator.share({ title, text: "Check out this ASA video", url: src });
      } else {
        await navigator.clipboard.writeText(src);
        alert("Link copied!");
      }
    } catch {}
  };

  const Home = () => (
    <div
      {...handlers}
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
        paddingBottom: isDesktop ? "110px" : "90px",
      }}
    >
      {/* Gradient header */}
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
        }}
      >
        ASA Dashboard
      </header>

      {/* Search Bar */}
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
          width: isDesktop ? "55%" : "80%",
          height: "32px",
          borderRadius: "20px",
          border: "none",
          padding: "0 15px",
          fontSize: "0.9rem",
          outline: "none",
          zIndex: 3,
        }}
      />

      {/* Video */}
      <video
        key={index + search}
        ref={videoRef}
        src={videos[index].src}
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        style={{
          width: isDesktop ? "90%" : "100%",
          height: "100%", // force full height on desktop
          objectFit: "cover",
          borderRadius: isDesktop ? "10px" : "0px",
        }}
      />

      {/* Title/Description */}
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
        <h3 style={{ margin: 0 }}>{videos[index].title}</h3>
        <p style={{ margin: "4px 0 0", opacity: 0.9 }}>{videos[index].desc}</p>
      </div>

      {/* Overlay actions (keep your emojis) */}
      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 210,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          color: "white",
          fontSize: "2rem",
          zIndex: 4,
        }}
      >
        <button onClick={handleLike} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
          {likes[index] ? "❤️‍🔥" : "🤍"}
        </button>
        <button onClick={() => setShowComments(true)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
          💬
        </button>
        <button onClick={shareVideo} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
          🔗
        </button>
      </div>

      {/* Progress bar */}
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

      {/* Comments panel — lifted and fixed input focus */}
      {showComments && (
        <div
          style={{
            position: "absolute",
            bottom: 180, // lifted so input is fully visible
            left: 0,
            width: "100%",
            height: "35%", // reduced height for better fit
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
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
            ⬇️ Close
          </div>

          <div style={{ flex: 1, overflowY: "auto", marginBottom: "10px" }}>
            {(comments[index] || []).map((c, i) => (
              <div key={i} style={{ marginBottom: "8px" }}>{c}</div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", zIndex: 10 }}>
            <input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Add a comment…"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.9)",
                color: "black",
                fontSize: "0.95rem",
              }}
            />
            <button
              onClick={addComment}
              style={{
                background: "#28a745", // green
                border: "none",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Swipe hint */}
      <div
        style={{
          position: "absolute",
          bottom: 150, // lifted for desktop
          width: "100%",
          textAlign: "center",
          color: "white",
          opacity: 0.8,
          fontSize: "1rem",
          zIndex: 4,
        }}
      >
        👉 Swipe left or right to watch next
      </div>
    </div>
  );

  const Chats = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1 }}>
      <h2>💬 Chats</h2>
      <p>Your conversations will appear here...</p>
    </div>
  );

  const Profile = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1 }}>
      <h2>👤 Profile</h2>
      <p>Total Likes: {Object.values(likes).filter(Boolean).length}</p>
      <p>Total Comments: {Object.values(comments).reduce((acc, arr) => acc + (arr?.length || 0), 0)}</p>
    </div>
  );

  const Events = () => (
    <div style={{ padding: 20, color: "white", background: "#111", flex: 1 }}>
      <h2>🎉 Events</h2>
      <p>Upcoming events will appear here...</p>
    </div>
  );

  const renderContent = () => {
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
      }}
    >
      <div style={{ flex: 1 }}>{renderContent()}</div>

      {/* FIXED BOTTOM MENU — exactly as you provided */}
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
        <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer" }}>
          🎬 Home
        </div>
        <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer" }}>
          💬 Chats
        </div>
        <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer" }}>
          👤 Profile
        </div>
        <div onClick={() => setActiveTab("events")} style={{ cursor: "pointer" }}>
          🎉 Events
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
