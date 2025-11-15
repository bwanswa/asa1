import React, { useState, useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";

// ---------------------------
// VIDEO LIST
// ---------------------------
const videos = [
  { src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Introduction" },
  { src: "https://www.w3schools.com/html/movie.mp4", title: "Unity Message" },
  { src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Community Highlights" },
];

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState("");
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);

  // ---------------------------
  // SWIPE
  // ---------------------------
  const swipe = useSwipeable({
    onSwipedLeft: () => nextVideo(),
    onSwipedRight: () => prevVideo(),
    trackMouse: true,
  });

  const nextVideo = () => {
    setIndex((i) => (i + 1) % videos.length);
    setProgress(0);
  };

  const prevVideo = () => {
    setIndex((i) => (i - 1 + videos.length) % videos.length);
    setProgress(0);
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
    document.getElementById("video-wrapper").appendChild(heart);

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
        navigator.clipboard.writeText(videos[index].src);
        alert("Link copied!");
      }
    } catch (err) {}
  };

  // ---------------------------
  // HOME PAGE
  // ---------------------------
  const HomePage = () => (
    <div
      {...swipe}
      id="video-wrapper"
      onClick={handleLike}
      style={{ position: "relative", height: "100%", width: "100%", background: "black" }}
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

      <div style={{ position: "absolute", top: 20, left: 20, color: "white", fontSize: "1.2rem", fontWeight: "bold" }}>
        {videos[index].title}
      </div>

      <div style={{ position: "absolute", right: 15, bottom: 120, display: "flex", flexDirection: "column", gap: "20px", color: "white", fontSize: "2rem" }}>
        <div onClick={handleLike} style={{ cursor: "pointer" }}>{likes[index] ? "🔥❤️" : "🤍"}</div>
        <div onClick={() => setShowComments(true)} style={{ cursor: "pointer" }}>💬</div>
        <div onClick={shareVideo} style={{ cursor: "pointer" }}>🔗</div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: `${progress}%`, height: "5px", background: "#FFD700" }} />

      {showComments && (
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "15px", color: "white" }}>
          <div style={{ textAlign: "center", marginBottom: "10px" }} onClick={() => setShowComments(false)}>⬇️ Close</div>
          <div style={{ height: "60%", overflowY: "auto", marginBottom: "10px" }}>
            {(comments[index] || []).map((c, i) => (<div key={i} style={{ marginBottom: "8px" }}>{c}</div>))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment…" style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none" }} />
            <button onClick={addComment} style={{ background: "#FFD700", border: "none", borderRadius: "10px", padding: "10px 15px", color: "black", fontWeight: "bold" }}>Send</button>
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
    if (activeTab === "chats") return <div style={{ padding: 20 }}><h2>💬 Chats</h2></div>;
    if (activeTab === "profile") return <div style={{ padding: 20 }}><h2>👤 Profile</h2></div>;
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "linear-gradient(to right,#006400,#FFD700,#8B0000)", color: "white", padding: "15px 20px", fontWeight: "bold" }}>
        ASA Dashboard
      </header>

      <main style={{ flex: 1 }}>{renderContent()}</main>

      <nav style={{ background: "linear-gradient(to right,#006400,#FFD700,#8B0000)", display: "flex", justifyContent: "space-around", padding: "10px 0", position: "fixed", bottom: 0, width: "100%", color: "white" }}>
        <button onClick={() => setActiveTab("home")}>🎬 Home</button>
        <button onClick={() => setActiveTab("chats")}>💬 Chats</button>
        <button onClick={() => setActiveTab("profile")}>👤 Profile</button>
      </nav>
    </div>
  );
};

export default Dashboard;
