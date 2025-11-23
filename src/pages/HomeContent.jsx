// pages/HomeContent.jsx
import React from 'react';
// UPDATED: Flat Import
import { CommentsPanel } from './CommentsPanel'; 

// Utility to check if running in a desktop-like environment
const isDesktopCheck = typeof window !== "undefined" ? window.innerWidth > 768 : true;

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

export const HomeContent = ({ 
    videoToDisplay, 
    videoStats, 
    likes, 
    videoComments,
    search,
    setSearch,
    userId,
    auth,
    handleIndexChange,
    handleLike,
    shareVideo,
    addVideoComment,
    commentInput,
    setCommentInput,
    showComments,
    setShowComments,
    handleStart, 
    handleEnd, 
    handleMove, 
    handleCancel,
    videoRef
}) => {
    if (!videoToDisplay) return (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
            {search ? `No videos match your search term "${search}" 😔` : "Loading videos..."} 
        </div>
    );
    
    const videoId = videoToDisplay.id;
    const isLiked = likes[videoId];
    const currentStats = videoStats[videoId] || { likes: 0, comments: 0 };
    const likeCount = currentStats.likes;
    const commentCount = currentStats.comments;

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
          if (v && v.paused) v.play().catch(() => {});
        }}
      >
        <header /* Top Header Bar */
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
            <span style={{ fontSize: '0.7rem', fontWeight: 'normal', opacity: 0.8 }}>
                User: {userId ? auth.currentUser?.email || userId.substring(0, 8) + '...' : 'Guest'}
                <p>
                    <button 
                        onClick={auth.signOut().then(() => { window.location.href = "/Login"; }).catch((error) => { console.error("Logout error:", error); })}
                        style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
                    >
                        Logout
                    </button>
                </p>
            </span>
        </header>

        <input /* Search Bar */
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            position: "absolute",
            top: 54,
            left: "50%",
            transform: "translateX(-50%)",
            width: isDesktopCheck ? "55%" : "90%",
            height: "40px", 
            borderRadius: "8px", 
            border: "1px solid #FFD700",
            background: "rgba(30, 30, 30, 0.9)", 
            padding: "0 15px",
            fontSize: "1rem",
            color: "white", 
            outline: "none",
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.3s',
            zIndex: 3,
          }}
        />

        <video /* Video Player */
          key={videoToDisplay.id + search} 
          ref={videoRef}
          src={videoToDisplay.src}
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{
            width: isDesktopCheck ? "90%" : "100%",
            height: "100%", 
            objectFit: "cover",
            borderRadius: isDesktopCheck ? "10px" : "0px",
          }}
          onError={() => console.error(`Failed to load video: ${videoToDisplay.src}`)}
        />

        <div /* Video Metadata */
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

        <div /* Social Actions Bar */
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
            <button onClick={handleLike} style={actionButtonStyle}> {/* Like Button */}
                <div style={{ 
                    ...iconStyle, 
                    transform: isLiked ? 'scale(1.1)' : 'scale(1.0)',
                    transition: 'transform 0.2s ease-in-out',
                    color: isLiked ? '#FFD700' : 'white',
                    fontWeight: isLiked ? 'bold' : 'normal',
                }}>
                    {isLiked ? "🔥" : "🤍"}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{likeCount}</span> 
            </button>
            
            <button onClick={() => setShowComments(true)} style={actionButtonStyle}> {/* Comment Button */}
                <div style={iconStyle}>
                    💬
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{commentCount}</span>
            </button>

            <button onClick={shareVideo} style={actionButtonStyle}> {/* Share Button */}
                <div style={iconStyle}>
                    🔗
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Share</span>
            </button>
        </div>

        {/* The Progress Bar (Currently static) */}
        <div 
          style={{
            position: "absolute",
            bottom: 130, 
            left: 0,
            width: "0%",
            height: "4px",
            background: "#FFD700",
            zIndex: 4,
          }}
        />

        {showComments && (
           <CommentsPanel
                videoToDisplay={videoToDisplay} 
                videoComments={videoComments}
                videoStats={videoStats}
                userId={userId}
                commentInput={commentInput}
                setCommentInput={setCommentInput}
                addVideoComment={addVideoComment}
                setShowComments={setShowComments}
            />
        )}

        <div /* Swipe Hint */
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
