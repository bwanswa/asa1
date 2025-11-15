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
    appId: "1:195882381688:web:b1d752c00c7a8740d0469b",
};

// 2. FIREBASE INITIALIZATION AND CONTEXT
const app = initializeApp(customFirebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// -----------------------------------------------------------
// --- SHARED UI COMPONENTS ---
// -----------------------------------------------------------

// SystemModal is a placeholder for custom dialogs (since alert() is forbidden)
const SystemModal = ({ message = "An important message.", onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full border-t-4 border-yellow-400">
            <h3 className="text-xl font-bold mb-3 text-yellow-400">System Alert</h3>
            <p className="text-gray-300 mb-6">{message}</p>
            <button
                onClick={onClose}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold py-2 rounded-lg transition"
            >
                Close
            </button>
        </div>
    </div>
);

// -----------------------------------------------------------
// --- VIDEO FEED COMPONENTS (Replaced Dashboard) ---
// -----------------------------------------------------------

// Mock Video Data
const mockVideos = [
    // Using a common placeholder video URL for demonstration. In a real app, this would be ASA's content.
    { id: 1, title: "ASA Product Launch (Swipe Up)", views: "1.2M", likes: "50k", duration: "0:58", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm", color: "bg-red-900" },
    { id: 2, title: "Q3 Financials Breakdown", views: "800k", likes: "35k", duration: "1:15", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm", color: "bg-blue-900" },
    { id: 3, title: "Behind the Scenes at ASA", views: "2.1M", likes: "120k", duration: "0:45", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm", color: "bg-green-900" },
    { id: 4, title: "New Feature Demo", views: "550k", likes: "28k", duration: "1:05", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm", color: "bg-purple-900" },
    { id: 5, title: "Team Culture Day", views: "1.5M", likes: "75k", duration: "0:50", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm", color: "bg-yellow-900" },
];

const VideoPlayer = ({ video, isActive }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false); // Initial state set to false, controlled by useEffect

    // EFFECT 1: Control play/pause based on visibility (the "swipe" mechanism)
    useEffect(() => {
        if (!videoRef.current) return;
        
        if (isActive) {
            // Attempt to play only the active video (must be muted for autoplay)
            videoRef.current.play().catch(e => {
                // Suppress common errors related to play interruption/autoplay policy
                if (e.name !== "NotAllowedError" && e.name !== "AbortError") {
                    console.error("Video Playback Error:", e);
                }
            });
            setIsPlaying(true);
        } else {
            // When inactive (out of view), always pause
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [isActive]);


    const togglePlay = () => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            videoRef.current.play().catch(e => console.error("Manual Play Error:", e));
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    return (
        // Full screen height, centered content (p-0 for full video coverage)
        <div className={`relative flex items-end justify-center h-full w-full p-0 overflow-hidden`}>
            
            {/* The Actual Video Player (fills container) */}
            <video
                ref={videoRef}
                src={video.src}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay={false} // Autoplay controlled by the useEffect now
                loop
                muted // Muted required for initial un-prompted play
                playsInline
                onClick={togglePlay}
                onError={(e) => {
                    console.error("Video failed to load", e);
                    // Fallback visual indicator if the placeholder fails
                    if(videoRef.current) {
                        videoRef.current.style.backgroundColor = video.color;
                        videoRef.current.style.filter = 'grayscale(100%)';
                    }
                }}
            >
                Your browser does not support the video tag.
            </video>

            {/* Play/Pause Overlay Button */}
            <div 
                className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
                onClick={togglePlay}
            >
                {!isPlaying && (
                    <span className="text-white text-6xl opacity-90 transition-opacity p-4 rounded-full bg-black/50">
                        ▶️
                    </span>
                )}
            </div>

            {/* Gradient Overlay for better text readability */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent z-10"></div>
            
            {/* Top Info (Title) */}
            <div className="absolute top-6 left-6 right-6 z-30 text-white">
                 <h1 className="text-3xl font-extrabold text-white drop-shadow-lg">{video.title}</h1>
            </div>

            {/* Action Buttons (Right Side) */}
            {/* Adjusted bottom position to clear the info bar */}
            <div className="absolute right-6 bottom-24 z-30 space-y-6"> 
                <button onClick={() => console.log('Liked')} className="flex flex-col items-center text-red-400 hover:text-red-300 transition drop-shadow-lg">
                    <span className="text-3xl">❤️</span>
                    <span className="text-sm font-semibold">{video.likes}</span>
                </button>
                <button onClick={() => console.log('Commented')} className="flex flex-col items-center text-blue-400 hover:text-blue-300 transition drop-shadow-lg">
                    <span className="text-3xl">💬</span>
                    <span className="text-sm font-semibold">1.2k</span>
                </button>
                <button onClick={() => console.log('Shared')} className="flex flex-col items-center text-white hover:text-gray-300 transition drop-shadow-lg">
                    <span className="text-3xl">🔗</span>
                    <span className="text-sm font-semibold">Share</span>
                </button>
            </div>


            {/* Bottom Info Bar (Left Side) - Now part of the bottom layer for good visibility */}
            <div className="w-full z-30 text-white flex justify-between items-center px-6 pb-6 pt-3">
                <p className="font-semibold text-xl drop-shadow-md">{video.views} Views</p>
                <p className="text-md text-gray-300 drop-shadow-md">{video.duration} runtime</p>
            </div>
        </div>
    );
};


const HomePage = () => {
    const containerRef = useRef(null);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0); 
    
    // Ref to hold drag state without triggering re-renders
    const dragState = useRef({ isDown: false, startY: 0, scrollTop: 0 }); 

    // Logic to track current video index based on scroll position
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            
            // Use requestAnimationFrame for smoother index tracking
            let frameScheduled = false;

            const updateIndex = () => {
                 const scrollTop = containerRef.current.scrollTop;
                 const height = containerRef.current.clientHeight;
                 
                 // Calculate which video is currently snapped 
                 const newIndex = Math.round(scrollTop / height);
                 
                 if (newIndex !== currentVideoIndex) {
                     setCurrentVideoIndex(newIndex);
                 }
                 frameScheduled = false;
            };

            if (!frameScheduled) {
                requestAnimationFrame(updateIndex);
                frameScheduled = true;
            }
        };

        const container = containerRef.current;
        if (container) {
            // Ensure initial video (index 0) is playing
            setCurrentVideoIndex(0); 
            container.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, [currentVideoIndex]);

    // --- MOUSE DRAG HANDLERS ---
    const handleMouseDown = (e) => {
        if (!containerRef.current) return;
        dragState.current.isDown = true;
        dragState.current.startY = e.pageY;
        dragState.current.scrollTop = containerRef.current.scrollTop;
        
        // Change cursor to indicate dragging
        containerRef.current.style.cursor = 'grabbing';
        containerRef.current.style.userSelect = 'none'; // Prevent text selection
    };

    const handleMouseUp = () => {
        if (!containerRef.current) return;
        dragState.current.isDown = false;
        containerRef.current.style.cursor = 'grab';
        containerRef.current.style.userSelect = 'auto';
    };

    const handleMouseMove = (e) => {
        if (!dragState.current.isDown) return;
        e.preventDefault(); 
        
        const container = containerRef.current;
        if (!container) return;

        // Calculate how far the mouse has moved
        const walk = e.pageY - dragState.current.startY; 
        
        // Apply the inverse movement to the scroll position 
        // (Dragging down [positive walk] moves the content up [negative scroll change])
        container.scrollTop = dragState.current.scrollTop - walk;
    };
    // ----------------------------


    return (
        // IMPORTANT: Added the drag handlers and the initial cursor style here.
        <div 
            ref={containerRef}
            className="w-full h-[calc(100vh-68px)] overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar"
            style={{ cursor: 'grab' }} 
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseUp} // Stops dragging if the mouse leaves the container
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            {mockVideos.map((video, index) => (
                // h-full and snap-start ensure each video fills the container and snaps into place
                <div key={video.id} className="h-full snap-start flex-shrink-0">
                    <VideoPlayer 
                        video={video} 
                        isActive={index === currentVideoIndex} // Pass isActive status
                    />
                </div>
            ))}
        </div>
    );
};

// -----------------------------------------------------------
// --- OTHER TAB CONTENT COMPONENTS (Adjusted for padding) ---
// -----------------------------------------------------------

const ChatsPage = () => (
    // Added pb-20 padding to clear the fixed bottom navigation bar
    <div className="p-6 pb-20"> 
        <h2 className="text-3xl font-bold mb-4 text-yellow-400">Your Chats</h2>
        <p className="text-gray-300">
            Start a conversation with a friend from your contact list!
        </p>
        <div className="mt-6 space-y-4">
            <ChatPreview name="Gemini AI" lastMessage="Ready to assist!" time="Now" />
            <ChatPreview name="Alice" lastMessage="See you tomorrow." time="5m ago" />
        </div>
    </div>
);

const ChatPreview = ({ name, lastMessage, time }) => (
    <div className="flex items-center p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-lg font-bold mr-4">
            {name[0]}
        </div>
        <div className="flex-1">
            <p className="text-white font-semibold">{name}</p>
            <p className="text-sm text-gray-400 truncate">{lastMessage}</p>
        </div>
        <p className="text-xs text-gray-500">{time}</p>
    </div>
);

const ProfilePage = ({ user, handleSignOut }) => (
    // Added pb-20 padding to clear the fixed bottom navigation bar
    <div className="p-6 pb-20">
        <h2 className="text-3xl font-bold mb-6 text-red-400">User Profile</h2>
        
        {user ? (
            <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded-xl shadow-lg">
                    <p className="text-gray-400">UID:</p>
                    <p className="text-sm break-all text-white font-mono">{user.uid}</p>
                </div>
                <div className="p-4 bg-gray-800 rounded-xl shadow-lg">
                    <p className="text-gray-400">Email:</p>
                    <p className="text-white font-semibold">{user.email || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-800 rounded-xl shadow-lg">
                    <p className="text-gray-400">Display Name:</p>
                    <p className="text-white font-semibold">{user.displayName || 'Anonymous User'}</p>
                </div>
                
                <button 
                    onClick={handleSignOut}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition mt-6"
                >
                    Sign Out
                </button>
            </div>
        ) : (
            <p className="text-gray-400">Loading user data...</p>
        )}
    </div>
);

// -----------------------------------------------------------
// --- NEW CONTACT LIST PANEL COMPONENT ---
// -----------------------------------------------------------

const mockFriends = [
    { id: 1, name: "Gemini AI", status: "Online", avatar: "🤖", statusColor: "bg-green-500" },
    { id: 2, name: "Alice", status: "Offline", avatar: "👩", statusColor: "bg-gray-500" },
    { id: 3, name: "Bob", status: "Online", avatar: "👨", statusColor: "bg-green-500" },
    { id: 4, name: "Charlie", status: "Away", avatar: "🐻", statusColor: "bg-yellow-500" },
    { id: 5, name: "Diana", status: "Online", avatar: "🦊", statusColor: "bg-green-500" },
    { id: 6, name: "Eve", status: "Offline", avatar: "🦁", statusColor: "bg-gray-500" },
    { id: 7, name: "Frank", status: "Online", avatar: "🦉", statusColor: "bg-green-500" },
    // Add more to show scrolling
    { id: 8, name: "Grace", status: "Online", avatar: "🦄", statusColor: "bg-green-500" },
    { id: 9, name: "Henry", status: "Away", avatar: "🐺", statusColor: "bg-yellow-500" },
    { id: 10, name: "Ivy", status: "Online", avatar: "🐲", statusColor: "bg-green-500" },
];

const ContactListItem = ({ friend }) => (
    <div className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition cursor-pointer">
        <div className="relative mr-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-xl">
                {friend.avatar}
            </div>
            {/* Status Indicator */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 ${friend.statusColor} rounded-full ring-2 ring-gray-900`}></div>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{friend.name}</p>
            <p className="text-xs text-gray-400">{friend.status}</p>
        </div>
    </div>
);

const ContactListPanel = () => (
    // This panel is hidden on mobile and shows on desktop (md:block)
    // pb-20 to clear the bottom navigation bar if it's visible on desktop
    <div className="hidden md:block w-72 bg-gray-900 border-l border-gray-700 h-full overflow-y-auto pt-6 pb-20">
        <div className="px-4 mb-4">
            <h3 className="text-xl font-bold text-yellow-400 border-b border-gray-700 pb-2">
                Friends ({mockFriends.length})
            </h3>
        </div>
        <div className="space-y-1 px-2">
            {mockFriends.map(friend => (
                <ContactListItem key={friend.id} friend={friend} />
            ))}
        </div>
    </div>
);


// -----------------------------------------------------------
// --- AUTH/MAIN APPLICATION COMPONENT ---
// -----------------------------------------------------------

const App = () => {
    // Initial state set to 'home' to land on the new video feed
    const [activeTab, setActiveTab] = useState("home"); 
    const [user, setUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const isAuthReady = useRef(false);

    // 3. AUTH EFFECT
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                // If not signed in, sign in anonymously for Firebase access
                try {
                    await auth.signInAnonymously();
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                    // This is a major error, so we show a modal
                    setShowModal(true);
                }
            }
            isAuthReady.current = true;
        });
        return () => unsubscribe();
    }, []);

    // 4. HANDLERS
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setUser(null);
            // After sign out, the onAuthStateChanged listener will trigger the anonymous sign-in
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // 5. RENDER LOGIC
    const renderContent = () => {
        if (!isAuthReady.current) {
            return (
                <div className="flex-1 flex items-center justify-center text-white">
                    <p>Loading application...</p>
                </div>
            );
        }

        switch (activeTab) {
            case "home":
                return <HomePage />;
            case "chats":
                return <ChatsPage />;
            case "profile":
                return <ProfilePage user={user} handleSignOut={handleSignOut} />;
            default:
                return null;
        }
    };

    // Main App Layout 
    return (
        <>
            {/* Inject CSS to hide the scrollbar for the video feed container */}
            <style>{`
                /* Hide scrollbar for Webkit browsers (Chrome, Safari) */
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }
                /* Hide scrollbar for Firefox and IE/Edge */
                .hide-scrollbar {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
            `}</style>
            
            {/* Added max-h-screen and overflow-hidden to ensure full screen layout */}
            <div className="h-screen w-screen flex flex-col bg-black text-white font-['Inter'] max-h-screen overflow-hidden">
                
                {/* Main Content & Right Panel Container */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left/Center Content (Existing Tab Content) */}
                    <div className="flex-1 min-w-0">
                        {renderContent()}
                    </div>

                    {/* Right Panel: Contact List */}
                    <ContactListPanel />

                </div>
                
                {showModal && <SystemModal onClose={() => setShowModal(false)} />}

                {/* Fixed Bottom Navigation Bar (Visible on all screens) */}
                <div
                    className="fixed bottom-0 w-full flex justify-around items-center 
                               bg-gray-900 border-t border-gray-700 text-white 
                               p-3 font-semibold text-sm z-10 shadow-lg" 
                >
                    <TabButton 
                        label="Feed" // UPDATED LABEL
                        icon="🎬" // UPDATED ICON
                        active={activeTab === 'home'} 
                        onClick={() => setActiveTab("home")} 
                    />
                    <TabButton 
                        label="Chats" 
                        icon="💬" 
                        active={activeTab === 'chats'} 
                        onClick={() => setActiveTab("chats")} 
                    />
                    <TabButton 
                        label="Profile" 
                        icon="👤" 
                        active={activeTab === 'profile'} 
                        onClick={() => setActiveTab("profile")} 
                    />
                </div>
            </div>
        </>
    );
};

// Helper component for bottom navigation
const TabButton = ({ label, icon, active, onClick }) => (
    <div 
        onClick={onClick} 
        className={`flex flex-col items-center cursor-pointer p-1 rounded-lg transition duration-200
                   ${active ? 'text-blue-400 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
    >
        <span className="text-xl mb-1">{icon}</span>
        <span className="text-xs">{label}</span>
    </div>
);

export default App;
