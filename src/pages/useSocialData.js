// pages/useSocialData.js
import { useState, useEffect } from "react";
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  serverTimestamp,
} from 'firebase/firestore'; 
// UPDATED: Flat Import for Hook dependency
import { useAuthAndFirebase } from './useAuthAndFirebase';

const INITIAL_VIDEOS = [
  { id: "v1", src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Global Initiative", desc: "Connecting the world" },
  { id: "v2", src: "https://www.w3schools.com/html/movie.mp4", title: "Future of Digital Learning", desc: "Exploring emerging technologies" },
  { id: "v3", src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Volunteer Spotlight Series", desc: "Making a difference in communities" },
];


export const useSocialData = (isAuthReady, userId, db) => {
    // Get appId from the auth hook
    const { appId } = useAuthAndFirebase(() => {}); 
    const [videos, setVideos] = useState(INITIAL_VIDEOS);
    const [videoStats, setVideoStats] = useState({});
    const [likes, setLikes] = useState({});
    const [videoComments, setVideoComments] = useState({});
    const [chatMessages, setChatMessages] = useState([]);

    // 3a. Fetch Videos (Public Collection)
    useEffect(() => {
        if (!isAuthReady || !db) return;
        
        const videosRef = collection(db, `artifacts/${appId}/public/data/videos`);
        
        const unsubscribe = onSnapshot(videosRef, (snapshot) => {
            if (snapshot.empty && videos.length === INITIAL_VIDEOS.length) {
                console.log("No videos found. Populating initial data...");
                
                INITIAL_VIDEOS.forEach(video => {
                    setDoc(doc(videosRef, video.id), {...video, timestamp: serverTimestamp()}).catch(e => 
                        console.error("Error setting initial video:", e));
                });
                setVideos(INITIAL_VIDEOS);
                return;
            }
            
            const fetchedVideos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            if (fetchedVideos.length > 0) {
                setVideos(fetchedVideos);
            }

        }, (error) => {
            console.error("Error fetching videos:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, db, appId]);

    // 3b. Fetch User Likes (Private Collection)
    useEffect(() => {
        if (!isAuthReady || !userId || !db) {
            setLikes({});
            return; 
        }

        const likesRef = collection(db, `artifacts/${appId}/users/${userId}/likes`);
        
        const unsubscribe = onSnapshot(likesRef, (snapshot) => {
            const userLikes = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.active !== false) {
                    userLikes[doc.id] = true; 
                }
            });
            setLikes(userLikes);
        }, (error) => {
            console.error("Error fetching likes:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, db, appId]);

    // 3c. Fetch Video Comments (Public Collection)
    useEffect(() => {
        if (!isAuthReady || !db) return;

        const commentsRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
        const q = query(commentsRef);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allComments = {};
            
            snapshot.docs.forEach(doc => {
                const commentData = doc.data();
                const videoId = commentData.videoId;
                
                if (videoId) {
                    if (!allComments[videoId]) {
                        allComments[videoId] = [];
                    }
                    allComments[videoId].push({
                        id: doc.id,
                        text: commentData.text,
                        userId: commentData.userId,
                        timestamp: commentData.timestamp?.toDate() || new Date(),
                    });
                }
            });
            
            // Sort comments by timestamp client-side
            Object.keys(allComments).forEach(videoId => {
                allComments[videoId].sort((a, b) => a.timestamp - b.timestamp);
            });
            
            setVideoComments(allComments);
        }, (error) => {
            console.error("Error fetching comments:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, db, appId]);
    
    // 3d. Fetch Global Chat Messages (Public Collection)
    useEffect(() => {
        if (!isAuthReady || !db) return;

        const chatRef = collection(db, `artifacts/${appId}/public/data/chatMessages`);
        const q = query(chatRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
            }));
        
            // Sort messages by timestamp client-side (ASC)
            fetchedMessages.sort((a, b) => a.timestamp - b.timestamp);

            setChatMessages(fetchedMessages);
        }, (error) => {
            console.error("Error fetching chat messages:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, db, appId]);

    // 3e. Fetch Public Video Stats (Likes/Comments Count)
    useEffect(() => {
        if (!isAuthReady || !db) return;

        const statsRef = collection(db, `artifacts/${appId}/public/data/videoStats`);
        const q = query(statsRef);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const stats = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                stats[doc.id] = {
                    likes: data.likes || 0,
                    comments: data.comments || 0,
                };
            });
            setVideoStats(stats);
        }, (error) => {
            console.error("Error fetching video stats:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, db, appId]);

    return {
        videos, 
        videoStats, 
        likes, 
        videoComments, 
        chatMessages
    };
};
