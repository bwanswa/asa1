/* global __app_id */
import React, { useState, useRef, useEffect, useCallback } from "react";

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
  runTransaction,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';

// Global variables provided by the Canvas environment
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'vercel-local-dev'; 
const appId = rawAppId.split(/[\/\-]/)[0]; 

// --- USER'S FIREBASE CONFIGURATION (Using the hardcoded configuration provided previously) ---
const customFirebaseConfig = {
    apiKey: "AIzaSyBRyHQf2IWzPoOrm8UsgcdJvDIxEQR2G40",
    authDomain: "asa1db.firebaseapp.com",
    projectId: "asa1db",
    storageBucket: "asa1db.firebasestorage.app",
    messagingSenderId: "195882381688",
    appId: "1:195882381688:web:b1d8e1f5a73e6b7c2d13b4"
};

// --- CONSTANTS ---
const HEADER_HEIGHT = 60; // in pixels
const NAV_HEIGHT = 60; // in pixels

// --- FIREBASE INITIALIZATION & AUTH ---

let firebaseApp, db, auth;
let isFirebaseInitialized = false;

const initFirebase = () => {
  if (isFirebaseInitialized) return;
  try {
    firebaseApp = initializeApp(customFirebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
};

// --- UTILITY COMPONENTS ---

const SystemModal = ({ message = "Authentication or operation in progress...", onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
      <p className="text-gray-800 font-semibold">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          Close
        </button>
      )}
    </div>
  </div>
);

// --- Data Structures ---

// Represents a single user's profile data
const defaultUserProfile = {
  uid: '',
  displayName: 'Guest User',
  photoURL: '',
  followerCount: 0,
  followingCount: 0,
  bio: 'A user on the platform.',
};

// Represents a single post (or "artifact")
const defaultPost = {
  id: '',
  userId: '',
  userName: 'Unknown',
  userPhoto: '',
  content: 'Default post content.',
  timestamp: Date.now(),
  likeCount: 0,
  commentCount: 0,
};

// --- FIRESTORE HELPERS ---

// Path for private user data (e.g., user profile, likes)
const getUserDocRef = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'userProfile', 'data');
const getLikesCollectionRef = (uid) => collection(db, 'artifacts', appId, 'users', uid, 'likes');

// Path for public data (e.g., posts, chats)
const getPublicCollectionRef = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);
const POSTS_REF = getPublicCollectionRef('posts');

// --- TABS (Content Components) ---

// Home Content (Feed)
const HomeContent = ({ user, db, auth, posts, userLikes, isLoading, handleLikePost }) => {
  if (isLoading) return <div className="p-4 text-center text-gray-500">Loading feed...</div>;
  if (posts.length === 0) return <div className="p-4 text-center text-gray-500">No posts yet. Be the first to post!</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Your Feed</h2>
      {posts.map((post) => {
        const isLiked = userLikes[post.id];
        return (
          <div key={post.id} className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center mb-3">
              <img 
                src={post.userPhoto || 'https://placehold.co/40x40/ccc/fff?text=U'} 
                alt={post.userName} 
                className="w-10 h-10 rounded-full mr-3 object-cover"
              />
              <div>
                <p className="font-semibold text-gray-800">{post.userName}</p>
                <p className="text-xs text-gray-500">
                  {new Date(post.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-gray-700 mb-4">{post.content}</p>
            
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <span className="font-bold">{post.likeCount}</span> Likes
              </span>
              <button 
                onClick={() => handleLikePost(post.id, isLiked)}
                className={`flex items-center space-x-1 transition duration-200 ${isLiked ? 'text-red-500 font-bold' : 'text-gray-400 hover:text-red-500'}`}
                disabled={!user}
              >
                {isLiked ? '❤️' : '🤍'}
                <span>Like</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Chat List Content (Placeholder)
const ChatList = () => (
  <div className="p-4">
    <h2 className="text-2xl font-bold text-gray-800 mb-4">Chats</h2>
    <div className="bg-white p-4 rounded-xl shadow-lg text-gray-600">
      <p>Chat functionality is coming soon! This is where your conversations will appear.</p>
    </div>
  </div>
);

// Profile Content
const ProfileContent = ({ user, userProfile, handleSignOut }) => {
  const profile = userProfile || defaultUserProfile;

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-2xl text-center">
        <img 
          src={profile.photoURL || 'https://placehold.co/100x100/3B82F6/fff?text=P'} 
          alt={profile.displayName} 
          className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-blue-500 shadow-md"
        />
        <h2 className="text-3xl font-extrabold text-gray-900">{profile.displayName}</h2>
        <p className="text-sm text-gray-500 mb-4">User ID: <span className="text-xs font-mono break-all">{profile.uid || 'N/A'}</span></p>
        
        <p className="text-gray-700 italic mb-6">"{profile.bio}"</p>

        <div className="flex justify-around text-lg font-semibold border-t pt-4">
          <div className="text-center">
            <p className="text-blue-600">{profile.followerCount}</p>
            <p className="text-gray-500 text-sm">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-blue-600">{profile.followingCount}</p>
            <p className="text-gray-500 text-sm">Following</p>
          </div>
        </div>
      </div>
      
      {user && (
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition duration-150"
        >
          {/* Replaced lucide-react icon with a hand wave emoji */}
          <span className="mr-2 text-xl">👋</span>
          Sign Out
        </button>
      )}
      {!user && (
        <p className="text-center text-gray-500 p-4 bg-gray-100 rounded-xl">
          Sign in to manage your profile!
        </p>
      )}
    </div>
  );
};

// Post Creation Component
const PostCreator = ({ user, userProfile }) => {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState('');

  const handlePost = async () => {
    if (!user || !userProfile || isPosting || content.trim() === '') {
      setError('Please sign in and enter some content.');
      return;
    }
    
    setIsPosting(true);
    setError('');

    try {
      const newPost = {
        userId: user.uid,
        userName: userProfile.displayName || 'Anonymous',
        userPhoto: userProfile.photoURL || '',
        content: content.trim(),
        timestamp: serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
      };

      await addDoc(POSTS_REF, newPost);

      setContent('');
    } catch (e) {
      console.error("Error adding document: ", e);
      setError('Failed to create post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  if (!user) {
    return (
      <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-lg">
        Please sign in to create a post.
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg mb-4">
      <textarea
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
        rows="3"
        placeholder={`What's on your mind, ${userProfile.displayName}?`}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (error) setError('');
        }}
        disabled={isPosting}
      ></textarea>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <button
        onClick={handlePost}
        disabled={isPosting || content.trim() === ''}
        className={`mt-3 w-full px-4 py-2 font-bold rounded-xl transition ${
          isPosting || content.trim() === ''
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600 shadow-md'
        }`}
      >
        {isPosting ? 'Posting...' : 'Post'}
      </button>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

const App = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState(null); // Firebase User object
  const [userProfile, setUserProfile] = useState(defaultUserProfile); // User's custom profile data
  const [posts, setPosts] = useState([]);
  const [userLikes, setUserLikes] = useState({}); // { postId: true/false }
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // 1. INITIALIZATION & AUTH LISTENER
  useEffect(() => {
    initFirebase();
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      
      if (currentUser) {
        // Automatically create/fetch profile on sign-in
        await fetchOrCreateUserProfile(currentUser);
      } else {
        setUserProfile(defaultUserProfile);
        setUserLikes({});
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. DATA FETCHERS (useEffect for all real-time data)

  // Fetch Posts
  useEffect(() => {
    if (!db || !isFirebaseInitialized) return;

    // Fetch the 50 most recent posts
    const q = query(POSTS_REF, orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firebase Timestamp to a JS date object or ensure it's a number
        timestamp: doc.data().timestamp?.toDate()?.getTime() || Date.now()
      }));
      setPosts(fetchedPosts);
    }, (error) => {
      console.error("Error fetching posts:", error);
    });

    return () => unsubscribe();
  }, [isLoading]); // Depend on isLoading to ensure auth is checked

  // Fetch User Likes
  useEffect(() => {
    if (!db || !user || !isFirebaseInitialized) return;

    const likesRef = getLikesCollectionRef(user.uid);
    const q = query(likesRef, where('liked', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likesMap = {};
      snapshot.docs.forEach(doc => {
        // Doc ID is the postId, value is always true
        likesMap[doc.id] = true;
      });
      setUserLikes(likesMap);
    }, (error) => {
      console.error("Error fetching user likes:", error);
    });

    return () => unsubscribe();
  }, [user, isLoading]);

  // 3. AUTHENTICATION HANDLERS

  const fetchOrCreateUserProfile = async (currentUser) => {
    if (!db || !currentUser) return;

    const profileRef = getUserDocRef(currentUser.uid);
    
    try {
      const docSnap = await getDoc(profileRef); // Use getDoc, not onSnapshot here for initial read

      if (docSnap.exists()) {
        const profileData = docSnap.data();
        setUserProfile({
          uid: currentUser.uid,
          displayName: currentUser.displayName || profileData.displayName || 'New User',
          photoURL: currentUser.photoURL || profileData.photoURL || '',
          ...profileData, // Overwrite with firestore data
        });
      } else {
        // Create initial profile if it doesn't exist
        const initialProfile = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'New User',
          photoURL: currentUser.photoURL || '',
          followerCount: 0,
          followingCount: 0,
          bio: 'My first profile on this platform.',
          createdAt: serverTimestamp(),
        };
        await setDoc(profileRef, initialProfile);
        setUserProfile(initialProfile);
      }
    } catch (e) {
      console.error("Error fetching/creating user profile:", e);
      setUserProfile({ ...defaultUserProfile, uid: currentUser.uid });
    }
  };

  const handleSignIn = async (providerName) => {
    if (!auth) {
      setModalMessage("Firebase Auth not initialized.");
      setShowModal(true);
      return;
    }

    const provider = providerName === 'google' 
      ? new GoogleAuthProvider() 
      : new GithubAuthProvider();

    setModalMessage("Signing in...");
    setShowModal(true);

    try {
      await signInWithPopup(auth, provider);
      // Auth state listener handles setting the user and fetching profile
    } catch (error) {
      console.error("Sign-in error:", error);
      setModalMessage(`Sign-in failed: ${error.message}`);
    } finally {
      setShowModal(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setModalMessage("Signing out...");
    setShowModal(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out error:", error);
      setModalMessage(`Sign-out failed: ${error.message}`);
    } finally {
      setShowModal(false);
    }
  };

  // 4. BUSINESS LOGIC HANDLERS

  const handleLikePost = useCallback(async (postId, currentlyLiked) => {
    if (!db || !user) {
        setModalMessage("Please sign in to like posts.");
        setShowModal(true);
        setTimeout(() => setShowModal(false), 2000);
        return;
    }

    const postRef = doc(POSTS_REF, postId);
    const likeDocRef = doc(getLikesCollectionRef(user.uid), postId);
    const delta = currentlyLiked ? -1 : 1;

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Update the Post's like count
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) {
                throw new Error("Post does not exist!");
            }
            const newLikeCount = (postDoc.data().likeCount || 0) + delta;
            transaction.update(postRef, { likeCount: newLikeCount < 0 ? 0 : newLikeCount });

            // 2. Update the User's like status
            if (currentlyLiked) {
                // Remove the like record
                transaction.delete(likeDocRef);
            } else {
                // Add the like record
                transaction.set(likeDocRef, { liked: true, timestamp: serverTimestamp() });
            }
        });

        // Optimistically update the local state for faster UI response
        setUserLikes(prev => {
          const newLikes = { ...prev };
          if (currentlyLiked) {
            delete newLikes[postId];
          } else {
            newLikes[postId] = true;
          }
          return newLikes;
        });

    } catch (e) {
        console.error("Transaction failed: ", e);
        setModalMessage("Failed to update like count. Try again.");
        setShowModal(true);
        setTimeout(() => setShowModal(false), 2000);
    }
  }, [db, user]);


  // 5. RENDER LOGIC

  const renderContent = () => {
    if (isLoading) {
      return <SystemModal message="Initializing and checking authentication..." />;
    }
    
    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-6">Welcome to Your Social Feed</h1>
          <p className="text-xl text-gray-600 mb-8 text-center">Sign in to start posting, liking, and chatting!</p>
          <button 
            onClick={() => handleSignIn('google')} 
            className="w-full max-w-xs flex items-center justify-center px-4 py-3 mb-4 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition duration-150"
          >
            <span className="text-2xl mr-3">G</span> Sign in with Google
          </button>
          <button 
            onClick={() => handleSignIn('github')} 
            className="w-full max-w-xs flex items-center justify-center px-4 py-3 bg-gray-800 text-white font-bold rounded-xl shadow-lg hover:bg-gray-900 transition duration-150"
          >
            <span className="text-2xl mr-3">🐙</span> Sign in with GitHub
          </button>
        </div>
      );
    }

    // Authenticated Content
    switch (activeTab) {
      case 'home':
        return (
          <div className="pt-4 pb-4">
            <PostCreator user={user} userProfile={userProfile} />
            <HomeContent 
              user={user} 
              db={db} 
              auth={auth} 
              posts={posts} 
              userLikes={userLikes} 
              isLoading={isLoading}
              handleLikePost={handleLikePost}
            />
          </div>
        );
      case 'chats':
        return <ChatList />;
      case 'profile':
        return <ProfileContent user={user} userProfile={userProfile} handleSignOut={handleSignOut} />;
      default:
        return <HomeContent 
          user={user} 
          db={db} 
          auth={auth} 
          posts={posts} 
          userLikes={userLikes} 
          isLoading={isLoading}
          handleLikePost={handleLikePost}
        />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans antialiased">
      {/* Header */}
      <header 
        className="fixed top-0 left-0 w-full bg-white shadow-md z-10 flex items-center justify-between px-4"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-yellow-500">
          SocialHub
        </h1>
        <div className="flex items-center space-x-2">
            <img 
              src={userProfile.photoURL || 'https://placehold.co/30x30/ccc/fff?text=U'} 
              alt="Profile" 
              className="w-8 h-8 rounded-full object-cover border border-gray-300"
            />
            <span className="text-sm font-semibold text-gray-700 hidden sm:inline">{userProfile.displayName}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className="flex-grow overflow-y-auto"
        style={{
          marginTop: `${HEADER_HEIGHT}px`,
          marginBottom: `${NAV_HEIGHT}px`,
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px - ${NAV_HEIGHT}px)`
        }}
      >
        <div className="max-w-xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* System Modal */}
      {showModal && <SystemModal message={modalMessage} onClose={modalMessage.includes('failed') ? () => setShowModal(false) : undefined} />}

      {/* Bottom Navigation Bar */}
      {user && (
        <div
          className="fixed bottom-0 left-0 w-full flex justify-around items-center text-white shadow-2xl"
          style={{
            background: "linear-gradient(to right, #006400, #FFD700, #8B0000)",
            zIndex: 20, 
            height: `${NAV_HEIGHT}px`,
          }}
        >
          {/* Emojis used instead of lucide-react icons */}
          {[
            { key: 'home', icon: '🏠', label: 'Home' },
            { key: 'chats', icon: '💬', label: 'Chats' },
            { key: 'profile', icon: '👤', label: 'Profile' },
          ].map(({ key, icon, label }) => (
            <div 
              key={key}
              onClick={() => setActiveTab(key)} 
              className={`flex flex-col items-center justify-center p-1 cursor-pointer transition-opacity ${activeTab === key ? 'opacity-100 scale-110' : 'opacity-60 hover:opacity-80'}`}
            >
              <span className="text-3xl leading-none">{icon}</span>
              <span className="text-xs font-semibold">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
