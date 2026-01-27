"use client";
import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Mic, MicOff, Radio, Settings, LogOut, Music } from "lucide-react";
import styles from "./admin.module.css";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

let socket;

export default function AdminPage() {
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [stream, setStream] = useState(null);
  const [audienceCount, setAudienceCount] = useState(0);
  const mediaRecorderRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const auth = localStorage.getItem("admin_auth");
    if (auth !== "true") {
      router.push("/admin/login");
      return;
    }

    socket = io();

    socket.on("user-count", (count) => {
      setAudienceCount(count);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, stream]);

  const toggleLive = async () => {
    if (!isLive) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(audioStream);
        setIsLive(true);
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus') 
          ? 'audio/webm; codecs=opus' 
          : 'audio/webm';

        const mediaRecorder = new MediaRecorder(audioStream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket) {
            socket.emit('audio-data', e.data);
          }
        };
        
        mediaRecorder.start(250); // Send chunks every 250ms
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Impossible d'accéder au microphone.");
      }
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsLive(false);
      if (socket) socket.emit("stop-stream");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_auth");
    router.push("/admin/login");
  };

  return (
    <div className={styles.container}>
      <Navbar />
      
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1>Tableau de Bord Admin</h1>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
          <p>Gérez vos émissions et lancez votre direct.</p>
        </div>

        <div className={styles.grid}>
          <div className={`${styles.card} ${isLive ? styles.liveCard : ""} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <Radio className={isLive ? styles.pulseIcon : ""} />
              </div>
              <div>
                <h3>Diffusion en Direct</h3>
                <p>{isLive ? "Vous êtes en direct" : "Hors ligne"}</p>
              </div>
            </div>

            <div className={styles.controls}>
              <button 
                className={`${styles.liveBtn} ${isLive ? styles.stopBtn : styles.startBtn}`}
                onClick={toggleLive}
              >
                {isLive ? "Arrêter la Diffusion" : "Lancer le Direct"}
              </button>
              
              {isLive && (
                <button 
                  className={styles.muteBtn}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </button>
              )}
            </div>
          </div>

          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <Music />
              </div>
              <div>
                <h3>Bibliothèque Musicale</h3>
                <p>Gérez vos fichiers audio</p>
              </div>
            </div>
            <button className={styles.secondaryBtn}>Ouvrir la Bibliothèque</button>
          </div>

          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <Settings />
              </div>
              <div>
                <h3>Paramètres</h3>
                <p>Configuration de la radio</p>
              </div>
            </div>
            <button className={styles.secondaryBtn}>Configurer</button>
          </div>
        </div>

        <div className={styles.statsSection}>
          <h2>Statistiques d'Audience</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{audienceCount}</span>
              <span className={styles.statLabel}>Auditeurs Actuels</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>1.2k</span>
              <span className={styles.statLabel}>Total Aujourd'hui</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>4.8/5</span>
              <span className={styles.statLabel}>Note Moyenne</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
