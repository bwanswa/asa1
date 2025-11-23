// pages/ProfileContent.jsx
import React from 'react';

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

export const ProfileContent = ({ 
    isAuthReady, 
    userId, 
    auth,
    likes, 
    chatMessages,
    signInWithGoogle,
    signInWithGithub,
    handleLogout,
    videos
}) => {
    const totalLikes = Object.values(likes).filter(Boolean).length;
    const totalChatMessages = chatMessages.length;
    const currentEmail = auth?.currentUser?.email;
    const appId = "asa1db"; // Placeholder/hardcoded value for display

    return (
        <div style={{ padding: 20, color: "white", background: "#111", flex: 1, overflowY: 'auto' }}>
            <h2>👤 Profile</h2>
            {isAuthReady ? (
                <div style={{marginBottom: '20px', padding: '15px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px'}}>
                    {userId ? ( // Logged In View
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
                    ) : ( // Logged Out View
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
