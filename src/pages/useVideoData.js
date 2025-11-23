// pages/useVideoData.js
import { useState, useEffect, useRef } from "react";

const INITIAL_VIDEOS = [
  // ... (video data)
];

// 🐛 FIX: Added 'showSystemMessage' to match the call in Dashboard.jsx
export const useVideoData = (videos, showSystemMessage) => { 
    const [index, setIndex] = useState(0);
    const [search, setSearch] = useState("");
    const inputStart = useRef({ x: 0, y: 0, isDragging: false });
    const videoRef = useRef(null);
    // ... (rest of the code remains the same)
    
    // ... (rest of the functions)
    
    return {
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
    };
};
