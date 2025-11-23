// pages/useSocialData.js
import { useState, useEffect } from "react";
import { 
  doc, 
  setDoc, 
  onSnapshot, 
// ... (other Firebase imports)
} from 'firebase/firestore'; 
// 👇 UPDATED: Import the static ID instead of the whole hook
import { STATIC_APP_ID } from './useAuthAndFirebase'; 

const INITIAL_VIDEOS = [
  // ... (video data)
];


export const useSocialData = (isAuthReady, userId, db) => {
    // ❌ REMOVED: const { appId } = useAuthAndFirebase(() => {}); 
    // 👇 NEW: Use the statically imported value
    const appId = STATIC_APP_ID; 

    const [videos, setVideos] = useState(INITIAL_VIDEOS);
    // ... (rest of the hook logic which uses appId)

    return {
        videos, 
        videoStats, 
        likes, 
        videoComments, 
        chatMessages
    };
};
