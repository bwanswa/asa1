// pages/useSocialActions.js
import { useState } from "react";
import { 
    doc, 
// ... (other Firebase imports)
} from 'firebase/firestore'; 
// 👇 UPDATED: Import the static ID instead of the whole hook
import { STATIC_APP_ID } from './useAuthAndFirebase'; 

export const useSocialActions = (db, userId, currentVideo, likes, showSystemMessage) => {
    // ❌ REMOVED: const { appId } = useAuthAndFirebase(() => {}); 
    // 👇 NEW: Use the statically imported value
    const appId = STATIC_APP_ID; 

    const [commentInput, setCommentInput] = useState("");
    const [chatInput, setChatInput] = useState("");
    const [showComments, setShowComments] = useState(false);

    // ... (rest of the hook logic which uses appId)

    return {
        // ... (return values)
    };
};
