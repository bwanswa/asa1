// pages/useSocialActions.js
import { useState } from "react";
import { 
    doc, 
    collection, 
    addDoc, 
    serverTimestamp,
    runTransaction
} from 'firebase/firestore'; 
// UPDATED: Flat Import for Hook dependency
import { useAuthAndFirebase } from './useAuthAndFirebase';

export const useSocialActions = (db, userId, currentVideo, likes, showSystemMessage) => {
    // Get appId from the auth hook
    const { appId } = useAuthAndFirebase(() => {}); 
    const [commentInput, setCommentInput] = useState("");
    const [chatInput, setChatInput] = useState("");
    const [showComments, setShowComments] = useState(false);

    // --- 4. FIREBASE Interaction Functions ---

    // Like toggle (Writes to Private Collection and updates Public Counter via Transaction)
    const handleLike = async () => {
        if (!db) return showSystemMessage("Data storage is disabled.");
        if (!userId) return showSystemMessage("Please sign in to like videos.");
        if (!currentVideo) return;
        
        const videoId = currentVideo.id;
        const isLiked = likes[videoId];

        // References for the private like status and the public stats counter
        const likeDocRef = doc(db, `artifacts/${appId}/users/${userId}/likes/${videoId}`);
        const statsDocRef = doc(db, `artifacts/${appId}/public/data/videoStats/${videoId}`);
        
        try {
            await runTransaction(db, async (transaction) => {
                const statsDoc = await transaction.get(statsDocRef);
                let currentLikes = statsDoc.exists() ? statsDoc.data().likes || 0 : 0;
        
                if (isLiked) {
                    // UNLIKE
                    transaction.set(likeDocRef, { active: false }, { merge: true });
                    
                    // Decrement public count
                    if (currentLikes > 0) {
                        transaction.set(statsDocRef, { likes: currentLikes - 1 }, { merge: true });
                    }
                    showSystemMessage("Unliked!");
                } else {
                    // LIKE
                    transaction.set(likeDocRef, { active: true, timestamp: serverTimestamp() });
                    // Increment public count
                    transaction.set(statsDocRef, { likes: currentLikes + 1 }, { merge: true });
                    showSystemMessage("Liked! 🔥");
                }
            });
        } catch (e) {
            console.error("Error running like transaction:", e);
            showSystemMessage("Error: Could not process like. Please try again.");
        }
    };

    // Add video comment (Writes to Public Collection and updates Public Counter via Transaction)
    const addVideoComment = async () => {
        if (!db) return showSystemMessage("Data storage is disabled.");
        if (!userId) return showSystemMessage("Please sign in to post comments.");
        if (!currentVideo) return;

        const text = commentInput.trim();
        if (!text) return;
        
        const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/videoComments`);
        const statsDocRef = doc(db, `artifacts/${appId}/public/data/videoStats/${currentVideo.id}`);
        
        try {
            await runTransaction(db, async (transaction) => {
                // 1. Add the comment
                const newCommentRef = doc(commentsCollectionRef); 
                transaction.set(newCommentRef, {
                    videoId: currentVideo.id,
                    userId: userId,
                    text: text,
                    timestamp: serverTimestamp(),
                });
                
                // 2. Increment public comment count
                const statsDoc = await transaction.get(statsDocRef);
                let currentCommentsCount = statsDoc.exists() ? statsDoc.data().comments || 0 : 0;
                
                transaction.set(statsDocRef, { comments: currentCommentsCount + 1 }, { merge: true });
            });
            setCommentInput("");
            showSystemMessage("Comment posted successfully!");
        } catch (e) {
            console.error("Error adding video comment:", e);
            showSystemMessage("Error: Could not post comment.");
        }
    };
    
    // Add global chat message (Writes to Public Collection)
    const addChatMessage = async () => {
        if (!db) return showSystemMessage("Data storage is disabled.");
        if (!userId) return showSystemMessage("Please sign in to chat globally.");

        const text = chatInput.trim();
        if (!text) return;
        
        const chatRef = collection(db, `artifacts/${appId}/public/data/chatMessages`);

        try {
            await addDoc(chatRef, {
                userId: userId,
                text: text,
                timestamp: serverTimestamp(),
            });
            setChatInput("");
        } catch (e) {
            console.error("Error adding chat message:", e);
            showSystemMessage("Error: Could not send message.");
        }
    };

    // Share (Uses Modal instead of alert)
    const shareVideo = async () => {
        try {
            if (!currentVideo) return;
            const { title } = currentVideo;
            
            const urlToShare = window.location.href;

            if (navigator.share) {
                await navigator.share({ title, text: "Check out this ASA video", url: urlToShare });
            } else {
                const contentToCopy = `Check out this video: ${title} - ${urlToShare}`;
                if (!navigator.clipboard || !navigator.clipboard.writeText) {
                    // Fallback for older browsers (document.execCommand('copy'))
                    const tempInput = document.createElement('input');
                    tempInput.value = contentToCopy;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                } else {
                    await navigator.clipboard.writeText(contentToCopy);
                }
                showSystemMessage("Link copied to clipboard! 📋");
            }
        } catch (e) {
            console.error("Share error:", e);
            showSystemMessage("Share failed or was cancelled.");
        }
    };

    return {
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
    };
};
