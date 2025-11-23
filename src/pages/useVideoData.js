// pages/useVideoData.js
import { useState, useEffect, useRef } from "react";

const INITIAL_VIDEOS = [
  { id: "v1", src: "https://www.w3schools.com/html/mov_bbb.mp4", title: "ASA Global Initiative", desc: "Connecting the world" },
  { id: "v2", src: "https://www.w3schools.com/html/movie.mp4", title: "Future of Digital Learning", desc: "Exploring emerging technologies" },
  { id: "v3", src: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", title: "Volunteer Spotlight Series", desc: "Making a difference in communities" },
];

const SWIPE_THRESHOLD = 50;

export const useVideoData = (videos) => {
    const [index, setIndex] = useState(0);
    const [search, setSearch] = useState("");
    const inputStart = useRef({ x: 0, y: 0, isDragging: false });
    const videoRef = useRef(null);

    // --- Utility Functions ---
    const handleIndexChange = (newIndex) => {
        const nextIndex = (newIndex + filteredVideos.length) % filteredVideos.length;
        setIndex(nextIndex < 0 ? filteredVideos.length + nextIndex : nextIndex);
    };

    // --- Filtered Videos Logic ---
    const filteredVideos = videos.filter(video =>
        video.title.toLowerCase().includes(search.toLowerCase()) || 
        video.desc.toLowerCase().includes(search.toLowerCase())
    );

    // Update index if current video is filtered out
    const currentVideo = filteredVideos[index % filteredVideos.length] || null;
    useEffect(() => {
        if (filteredVideos.length > 0) {
            const currentVideoStillExists = filteredVideos.some(v => v.id === currentVideo?.id);
            if (!currentVideoStillExists) {
                setIndex(0);
            }
        }
    }, [search, filteredVideos.length, currentVideo?.id]);

    // --- SWIPE/DRAG HANDLERS ---
    const getCoordinates = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        if (e.clientX !== undefined) {
            return { x: e.clientX, y: e.clientY };
        }
        return null;
    };

    const handleStart = (e) => {
        const coords = getCoordinates(e);
        if (coords) {
            inputStart.current = {
                x: coords.x,
                y: coords.y,
                isDragging: true,
            };
        }
        if (e.type === 'mousedown') {
            e.preventDefault();
        }
    };

    const handleEnd = (e) => {
        if (!inputStart.current.isDragging) return;

        const startX = inputStart.current.x;
        const startY = inputStart.current.y;
        inputStart.current.isDragging = false; 
        
        const coords = getCoordinates(e); 
        if (!coords) return;
        
        const diffX = startX - coords.x;
        const diffY = startY - coords.y;

        const absDiffX = Math.abs(diffX);
        const absDiffY = Math.abs(diffY);

        if (absDiffY > SWIPE_THRESHOLD && absDiffY > absDiffX) {
            if (diffY > 0) {
                handleIndexChange(index + 1);
            } else {
                handleIndexChange(index - 1);
            }
        }
    };

    const handleMove = (e) => {
        if (inputStart.current.isDragging && e.type === 'mousemove') {
            e.preventDefault();
        }
    }

    const handleCancel = () => {
        inputStart.current.isDragging = false;
    }
    
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
