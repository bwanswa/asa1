// pages/ChatsContent.jsx
import React, { useRef, useEffect } from 'react';

export const ChatsContent = ({ chatMessages, userId, chatInput, setChatInput, addChatMessage }) => {
    const chatScrollRef = useRef(null);

    // Scroll to bottom of chat when new messages arrive
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages]);

    return (
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

            <div style={{ display: "flex", gap: "10px", paddingBottom: '10px' }}> {/* Chat Input */}
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
};
