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
  const [isBuffering, setIsBuffering] = useState(false);
  const audioContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const queueRef = useRef([]);
  const queuedDurationRef = useRef(0);
  const schedulerIntervalRef = useRef(null);
  const INITIAL_BUFFER_SEC = 6.0; // Augmenté pour plus de stabilité sur connexions lentes
  const MAX_BUFFER_SEC = 15.0; // Un peu plus de marge
  const SAMPLE_RATE = 16000;

  const isPlayingRef = useRef(isPlaying);
  const isLiveRef = useRef(isLive);
  const volumeRef = useRef(volume);
  const isVolumeMutedRef = useRef(isMuted);
  const isBufferingRef = useRef(isBuffering);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    isLiveRef.current = isLive;
    volumeRef.current = volume;
    isVolumeMutedRef.current = isMuted;
    isBufferingRef.current = isBuffering;
  }, [isPlaying, isLive, volume, isMuted, isBuffering]);

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
      // Accumulate incoming chunks in a queue. A separate scheduler will
      // consume the queue and schedule AudioBufferSource nodes to smooth
      // playback and avoid gaps when the network is unstable.
      if (!isLiveRef.current) return;

      try {
        const int16Data = new Int16Array(data);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
          float32Data[i] = int16Data[i] / 0x7fff;
        }

        // push into queue
        queueRef.current.push(float32Data);
        queuedDurationRef.current += float32Data.length / SAMPLE_RATE;

        // drop old data if we grew too large
        while (
          queuedDurationRef.current > MAX_BUFFER_SEC &&
          queueRef.current.length > 0
        ) {
          const dropped = queueRef.current.shift();
          queuedDurationRef.current -= dropped.length / SAMPLE_RATE;
          console.warn("Dropping buffer chunk to keep buffer size bounded");
        }
      } catch (err) {
        console.error("Failed to enqueue audio chunk", err);
      }
    });

    // Scheduler: runs periodically to schedule buffered chunks into AudioContext
    const startScheduler = () => {
      if (schedulerIntervalRef.current) return;

      schedulerIntervalRef.current = setInterval(() => {
        if (!isPlayingRef.current || !isLiveRef.current) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new (
            window.AudioContext || window.webkitAudioContext
          )({ sampleRate: SAMPLE_RATE });
          nextStartTimeRef.current = 0;
        }

        const ac = audioContextRef.current;
        const now = ac.currentTime;

        if (
          nextStartTimeRef.current === 0 &&
          queuedDurationRef.current < INITIAL_BUFFER_SEC
        ) {
          if (!isBufferingRef.current) setIsBuffering(true);
          return;
        }

        if (isBufferingRef.current) setIsBuffering(false);

        if (nextStartTimeRef.current === 0) {
          nextStartTimeRef.current = now + 0.2; // small safety lead
        }

        // If we fell behind, resync a little
        if (nextStartTimeRef.current < now) {
          nextStartTimeRef.current = now + 0.1; // Un peu plus de marge pour le saut
        }

        // Schedule while we have queued data and we are within a reasonable lookahead
        const LOOKAHEAD = 6.0;
        while (
          queueRef.current.length > 0 &&
          nextStartTimeRef.current < now + LOOKAHEAD
        ) {
          const chunk = queueRef.current.shift();
          const duration = chunk.length / SAMPLE_RATE;

          const buffer = ac.createBuffer(1, chunk.length, SAMPLE_RATE);
          buffer.getChannelData(0).set(chunk);

          const source = ac.createBufferSource();
          source.buffer = buffer;

          const gainNode = ac.createGain();
          const targetGain = isVolumeMutedRef.current ? 0 : volumeRef.current;
          // small fade-in to avoid clicks/pops on chunk boundaries
          gainNode.gain.setValueAtTime(0.0001, nextStartTimeRef.current);
          gainNode.gain.linearRampToValueAtTime(
            Math.max(0, targetGain),
            nextStartTimeRef.current + 0.03,
          );

          source.connect(gainNode);
          gainNode.connect(ac.destination);

          try {
            source.start(nextStartTimeRef.current);
          } catch (e) {
            console.warn("Failed to start source", e);
          }

          nextStartTimeRef.current += duration;
          queuedDurationRef.current -= duration;
        }
      }, 150); // Un peu plus fréquent
    };

    const stopScheduler = () => {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
        schedulerIntervalRef.current = null;
      }
    };

    // Start scheduler when appropriate
    startScheduler();

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
      setIsBuffering(false);
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
          <span>{isLive ? (isBuffering ? "Mise en mémoire..." : "En Direct") : "Hors Ligne"}</span>
        </div>
        <h3 className={styles.title}>{isLive ? currentShow : "RTO"}</h3>
        <p className={styles.subtitle}>
          {isLive ? "En direct de la Cathédrale" : "La Voix de la Foi"}
        </p>
      </div>

      <div className={styles.controls}>
        <button className={styles.playBtn} onClick={togglePlay}>
          {isPlaying ? (
            <Pause fill="currentColor" />
          ) : (
            <Play fill="currentColor" />
          )}
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
              height: isPlaying ? [10, 30, 15, 40, 10] : 4,
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}
