// pages/Dashboard.jsx (The Orchestrator)
import React, { useState } from "react";
// UPDATED: Flat Imports for Hooks
import { useAuthAndFirebase } from './useAuthAndFirebase';
import { useVideoData } from './useVideoData';
import { useSocialData } from './useSocialData';
import { useSocialActions } from './useSocialActions';
// UPDATED: Flat Imports for UI Components
import { SystemModal } from './SystemModal';
import { HomeContent } from './HomeContent';
import { ChatsContent } from './ChatsContent';
import { ProfileContent } from './ProfileContent';
import { EventsContent } from './EventsContent';

const Dashboard = () => {
    // UI States that manage visibility and navigation
    const [activeTab, setActiveTab] = useState("home");
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState("");

    // Utility to show system messages
    const showSystemMessage = (message) => {
        setModalMessage(message);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 2000);
    };

    // --- 1. Custom Hooks for Logic and Data ---
    const { auth, db, userId, isAuthReady, signInWithGoogle, signInWithGithub, handleLogout } = useAuthAndFirebase(showSystemMessage);
    const { videos, videoStats, likes, videoComments, chatMessages } = useSocialData(isAuthReady, userId, db);
    // 👇 The fix ensures this call matches the hook signature
    const { 
        index, 
        setIndex, 
        search, 
        setSearch, 
        filteredVideos, 
        currentVideo, 
        handleIndexChange, 
        handleStart, 
        handleEnd, 
        handleMove, 
        handleCancel,
        videoRef 
    } = useVideoData(videos, showSystemMessage);
    const { 
        handleLike, 
        addVideoComment, 
        commentInput, 
        setCommentInput, 
        chatInput, 
        setChatInput, 
        addChatMessage, 
        shareVideo,
        showComments,
        setShowComments
    } = useSocialActions(db, userId, currentVideo, likes, showSystemMessage);

    // --- 2. Main Content Rendering ---
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
                return <HomeContent 
                    videoToDisplay={currentVideo} 
                    videoStats={videoStats} 
                    likes={likes} 
                    videoComments={videoComments}
                    search={search}
                    setSearch={setSearch}
                    userId={userId}
                    auth={auth}
                    handleIndexChange={handleIndexChange}
                    handleLike={handleLike}
                    shareVideo={shareVideo}
                    addVideoComment={addVideoComment}
                    commentInput={commentInput}
                    setCommentInput={setCommentInput}
                    showComments={showComments}
                    setShowComments={setShowComments}
                    handleStart={handleStart}
                    handleEnd={handleEnd}
                    handleMove={handleMove}
                    handleCancel={handleCancel}
                    videoRef={videoRef}
                />;
            case "chats":
                return <ChatsContent 
                    chatMessages={chatMessages} 
                    userId={userId}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    addChatMessage={addChatMessage}
                />;
            case "profile":
                return <ProfileContent 
                    isAuthReady={isAuthReady} 
                    userId={userId} 
                    auth={auth}
                    likes={likes} 
                    chatMessages={chatMessages}
                    signInWithGoogle={signInWithGoogle}
                    signInWithGithub={signInWithGithub}
                    handleLogout={handleLogout}
                    videos={videos}
                />;
            case "events":
                return <EventsContent />;
            default:
                return null;
        }
    };

    // --- 3. Main Return (Layout and Footer) ---
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
            
            {showModal && <SystemModal message={modalMessage} />}

            <div /* The Footer/Nav Bar */
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
                {/* Nav Links */}
                <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", opacity: activeTab === 'home' ? 1 : 0.7 }}>🎬 Home</div>
                <div onClick={() => setActiveTab("chats")} style={{ cursor: "pointer", opacity: activeTab === 'chats' ? 1 : 0.7 }}>💬 Chats</div>
                <div onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", opacity: activeTab === 'profile' ? 1 : 0.7 }}>👤 Profile</div>
                <div onClick={() => setActiveTab("events")} style={{ cursor: "pointer", opacity: activeTab === 'events' ? 1 : 0.7 }}>🎉 Events</div>
            </div>
        </div>
    );
};

export default Dashboard;
