"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import styles from "./RadioPlayer.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";

let socket;

export default function RadioPlayer({ currentShow }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const queueRef = useRef([]);

  useEffect(() => {
    socket = io();
    
    socket.on("live-status", (status) => {
      setIsLive(status);
      if (!status) {
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        queueRef.current = [];
      }
    });

    socket.on("audio-stream", async (data) => {
      const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
      
      if (isPlaying && sourceBufferRef.current && !sourceBufferRef.current.updating) {
        try {
          sourceBufferRef.current.appendBuffer(arrayBuffer);
        } catch (e) {
          console.error("Error appending buffer:", e);
        }
      } else {
        queueRef.current.push(arrayBuffer);
      }
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const startStreaming = () => {
    if (!window.MediaSource) {
      alert("Votre navigateur ne supporte pas le streaming en direct.");
      return;
    }
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    audioRef.current.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
      const mimeType = 'audio/webm; codecs=opus';
      if (!MediaSource.isTypeSupported(mimeType)) {
        console.error("MIME type not supported");
        return;
      }
      const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
      sourceBufferRef.current = sourceBuffer;

      sourceBuffer.addEventListener('updateend', () => {
        if (queueRef.current.length > 0 && !sourceBuffer.updating) {
          sourceBuffer.appendBuffer(queueRef.current.shift());
        }
      });
    });
  };

  const togglePlay = () => {
    if (!isPlaying) {
      if (isLive) {
        startStreaming();
        audioRef.current.play().catch(e => console.error("Playback error:", e));
      } else {
        alert("La radio est actuellement hors ligne.");
        return;
      }
    } else {
      audioRef.current.pause();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className={`${styles.playerContainer} glass`}>
      <div className={styles.info}>
        <audio ref={audioRef} hidden />
        <div className={isLive ? "live-indicator" : styles.offlineIndicator}>
          <div className={isLive ? "live-dot" : styles.offlineDot}></div>
          <span>{isLive ? "En Direct" : "Hors Ligne"}</span>
        </div>
        <h3 className={styles.title}>{isLive ? currentShow : "Radio Orthodoxe"}</h3>
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
