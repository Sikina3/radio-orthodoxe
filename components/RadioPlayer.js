"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import styles from "./RadioPlayer.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";

export default function RadioPlayer({ currentShow }) {
  const socketRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);

  const isPlayingRef = useRef(isPlaying);
  const isLiveRef = useRef(isLive);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    isLiveRef.current = isLive;
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
  }, [isPlaying, isLive, volume, isMuted]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    
    socket.on("live-status", (status) => {
      setIsLive(status);
      if (!status) {
        setIsPlaying(false);
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        nextStartTimeRef.current = 0;
      }
    });

    socket.on("audio-stream", async (data) => {
      if (!isPlayingRef.current || !isLiveRef.current) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 22050 });
        // Initial buffer: on commence à jouer avec un délai de 1.5 seconde
        // Cela permet d'absorber les variations de l'internet (jitter)
        nextStartTimeRef.current = audioContextRef.current.currentTime + 1.5;
        console.log("Starting audio stream with 1.5s buffer");
      }

      const audioContext = audioContextRef.current;
      
      // Si on est "trop" en retard sur le temps réel (plus de 3 secondes), on resynchronise
      if (nextStartTimeRef.current < audioContext.currentTime) {
        console.log("Buffer underflow, resyncing...");
        nextStartTimeRef.current = audioContext.currentTime + 0.5;
      }
      
      // Si on est "trop" en avance (plus de 5 secondes), on attend
      // (Peut arriver si l'admin envoie trop vite ou si on a eu une déconnexion)
      if (nextStartTimeRef.current > audioContext.currentTime + 5) {
        console.log("Buffer overflow, skipping forward...");
        nextStartTimeRef.current = audioContext.currentTime + 1.5;
      }

      const int16Data = new Int16Array(data);
      const float32Data = new Float32Array(int16Data.length);
      
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 0x7FFF;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Data.length, 22050);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const gainNode = audioContext.createGain();
      gainNode.gain.value = isMutedRef.current ? 0 : volumeRef.current;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const startTime = nextStartTimeRef.current;
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    // Pas besoin de mettre à jour audioRef.volume ici car on utilise Web Audio API
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!isPlaying) {
      if (isLive) {
        setIsPlaying(true);
      } else {
        alert("La radio est actuellement hors ligne.");
      }
    } else {
      setIsPlaying(false);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      nextStartTimeRef.current = 0;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className={`${styles.playerContainer} glass`}>
      <div className={styles.info}>
        <div className={isLive ? "live-indicator" : styles.offlineIndicator}>
          <div className={isLive ? "live-dot" : styles.offlineDot}></div>
          <span>{isLive ? "En Direct" : "Hors Ligne"}</span>
        </div>
        <h3 className={styles.title}>{isLive ? currentShow : "RTO"}</h3>
        <p className={styles.subtitle}>{isLive ? "En direct de la Cathédrale" : "La Voix de la Foi"}</p>
      </div>

      <div className={styles.controls}>
        <button className={styles.playBtn} onClick={togglePlay}>
          {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
        
        <div className={styles.volumeContainer}>
          <button onClick={toggleMute}>
            {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={isMuted ? 0 : volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className={styles.volumeSlider}
          />
        </div>
      </div>

      <div className={styles.visualizer}>
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className={styles.bar}
            animate={{
              height: isPlaying ? [10, 30, 15, 40, 10] : 4
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}
