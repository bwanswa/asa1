// pages/CommentsPanel.jsx
import React from 'react';

// Reusable styles
const inputStyle = (userId, commentInput) => ({
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.4)",
    background: userId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
    color: "black",
    fontSize: "0.95rem",
    outline: "none",
});

const sendButtonStyle = (userId, commentInput) => ({
    background: (!commentInput.trim() || !userId) ? "#aaa" : "#FFD700",
    border: "none",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "black",
    fontWeight: "bold",
    cursor: "pointer",
    transition: 'background 0.3s'
});

export const CommentsPanel = ({ 
    videoToDisplay, 
    videoComments, 
    videoStats, 
    userId, 
    commentInput, 
    setCommentInput, 
    addVideoComment, 
    setShowComments 
}) => {
    if (!videoToDisplay) return null;

    const videoId = videoToDisplay.id;
    const currentComments = videoComments[videoId] || [];
    const currentStats = videoStats[videoId] || { comments: 0 };
    const commentCount = currentStats.comments;

    return (
        <div // Main Panel Container
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
            <div // Close Button
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

            <div style={{ display: "flex", gap: "10px", zIndex: 10 }}> {/* Input Row */}
                <input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder={userId ? "Add a comment…" : "Sign in to comment..."}
                    disabled={!userId} 
                    style={inputStyle(userId, commentInput)}
                />
                <button
                    onClick={addVideoComment}
                    disabled={!commentInput.trim() || !userId}
                    style={sendButtonStyle(userId, commentInput)}
                >
                    Send
                </button>
            </div>
        </div>
    );
}
