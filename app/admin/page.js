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
  const [showTitle, setShowTitle] = useState("La Divine Liturgie");
  const [schedule, setSchedule] = useState([]);
  const [newScheduleItem, setNewScheduleItem] = useState({ time: "", title: "", host: "" });
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([
    { name: "Chant Byzantin 1.mp3", duration: "05:20" },
    { name: "Prière du Matin.mp3", duration: "12:45" },
    { name: "Cloches de la Cathédrale.wav", duration: "01:15" },
  ]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  
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

    socket.on("update-schedule", (newSchedule) => {
      setSchedule(newSchedule);
    });

    // Charger les périphériques audio
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) setSelectedDevice(audioInputs[0].deviceId);
      } catch (err) {
        console.error("Error listing devices:", err);
      }
    };
    getDevices();

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

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  const toggleLive = async () => {
    if (!isLive) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        setStream(audioStream);
        setIsLive(true);

        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(audioStream);
        sourceRef.current = source;

        // ScriptProcessorNode est déprécié mais plus simple à intégrer rapidement que AudioWorklet dans Next.js
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMuted) return;
          
          const inputData = e.inputBuffer.getChannelData(0);
          // Convertir Float32 en Int16 pour réduire la bande passante
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          
          if (socket) {
            socket.emit('audio-data', int16Data.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        if (socket) socket.emit("start-stream", showTitle);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Impossible d'accéder au microphone sélectionné.");
      }
    } else {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsLive(false);
      if (socket) socket.emit("stop-stream");
    }
  };

  const updateSchedule = () => {
    if (newScheduleItem.time && newScheduleItem.title) {
      const updated = [...schedule, newScheduleItem].sort((a, b) => a.time.localeCompare(b.time));
      setSchedule(updated);
      if (socket) socket.emit("update-schedule", updated);
      setNewScheduleItem({ time: "", title: "", host: "" });
    }
  };

  const removeScheduleItem = (index) => {
    const updated = schedule.filter((_, i) => i !== index);
    setSchedule(updated);
    if (socket) socket.emit("update-schedule", updated);
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

            <div className={styles.liveSettings}>
              <label>Nom de l'émission :</label>
              <input 
                type="text" 
                value={showTitle} 
                onChange={(e) => setShowTitle(e.target.value)}
                placeholder="Ex: La Divine Liturgie"
                disabled={isLive}
                className={styles.adminInput}
              />
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
                <p>{libraryFiles.length} fichiers disponibles</p>
              </div>
            </div>
            <button className={styles.secondaryBtn} onClick={() => setShowLibrary(!showLibrary)}>
              {showLibrary ? "Fermer" : "Ouvrir la Bibliothèque"}
            </button>
            
            {showLibrary && (
              <div className={styles.libraryList}>
                {libraryFiles.map((file, i) => (
                  <div key={i} className={styles.libraryItem}>
                    <span>{file.name}</span>
                    <span className={file.duration}>{file.duration}</span>
                  </div>
                ))}
                <button className={styles.addFileBtn}>+ Ajouter un fichier</button>
              </div>
            )}
          </div>

          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <Settings />
              </div>
              <div>
                <h3>Paramètres Audio</h3>
                <p>Configuration de la source</p>
              </div>
            </div>
            <div className={styles.audioSettings}>
              <select 
                className={styles.adminSelect} 
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                disabled={isLive}
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
                {audioDevices.length === 0 && <option>Aucun micro détecté</option>}
              </select>
              <p className={styles.hint}>Qualité : 128kbps (Opus)</p>
            </div>
          </div>
        </div>

        <div className={styles.managementGrid}>
          <div className={`${styles.card} glass`}>
            <h2>Programmation (À Venir)</h2>
            <div className={styles.scheduleForm}>
              <input 
                type="time" 
                value={newScheduleItem.time} 
                onChange={(e) => setNewScheduleItem({...newScheduleItem, time: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Titre de l'émission" 
                value={newScheduleItem.title}
                onChange={(e) => setNewScheduleItem({...newScheduleItem, title: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Animateur" 
                value={newScheduleItem.host}
                onChange={(e) => setNewScheduleItem({...newScheduleItem, host: e.target.value})}
              />
              <button onClick={updateSchedule} className={styles.addBtn}>Ajouter</button>
            </div>
            <div className={styles.adminScheduleList}>
              {schedule.map((item, i) => (
                <div key={i} className={styles.adminScheduleItem}>
                  <span className={styles.time}>{item.time}</span>
                  <div className={styles.info}>
                    <strong>{item.title}</strong>
                    <span>{item.host}</span>
                  </div>
                  <button onClick={() => removeScheduleItem(i)} className={styles.removeBtn}>×</button>
                </div>
              ))}
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
        </div>
      </main>
    </div>
  );
}
