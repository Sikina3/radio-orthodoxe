"use client";
import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Mic, MicOff, Radio, Settings, LogOut, Music } from "lucide-react";
import styles from "./admin.module.css";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const socketRef = useRef(null);
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

    const socket = io();
    socketRef.current = socket;

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
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
    
    // Effet de "Ducking" : baisse la musique quand on parle
    if (musicGainNodeRef.current && audioContextRef.current) {
      const targetGain = isMuted ? 1.0 : 0.3; // 30% du volume si le micro est ouvert
      const now = audioContextRef.current.currentTime;
      musicGainNodeRef.current.gain.setTargetAtTime(targetGain, now, 0.2); // Transition fluide de 200ms
    }
  }, [isMuted, stream]);

  const [playlist, setPlaylist] = useState([]);
  const playlistRef = useRef([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const currentTrackIndexRef = useRef(-1);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);
  const isPlaylistPlayingRef = useRef(false);
  const musicSourceRef = useRef(null);
  const musicGainNodeRef = useRef(null);
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mixedOutputRef = useRef(null);

  // Synchroniser les refs avec les états pour éviter les stale closures
  useEffect(() => {
    isPlaylistPlayingRef.current = isPlaylistPlaying;
  }, [isPlaylistPlaying]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newTracks = files.map(file => ({
      name: file.name,
      file: file,
      url: URL.createObjectURL(file)
    }));
    setPlaylist(prev => [...prev, ...newTracks]);
  };

  const toggleLive = async (startMuted = false) => {
    if (!isLive) {
      try {
        if (startMuted) setIsMuted(true);
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

        // Qualité : 16kHz Mono PCM (~256kbps) pour un compromis entre clarté (voix du prêtre) et stabilité réseau
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const mixedOutput = audioContext.createGain();
        mixedOutputRef.current = mixedOutput;

        const micSource = audioContext.createMediaStreamSource(audioStream);
        sourceRef.current = micSource;

        const highPass = audioContext.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 100;

        const eqPresence = audioContext.createBiquadFilter();
        eqPresence.type = "peaking";
        eqPresence.frequency.value = 3000;
        eqPresence.gain.value = 3;

        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
        
        micSource.connect(highPass);
        highPass.connect(eqPresence);
        eqPresence.connect(compressor);
        compressor.connect(mixedOutput);

        const musicGain = audioContext.createGain();
        musicGainNodeRef.current = musicGain;
        musicGain.connect(mixedOutput);

        // Augmenter la taille du buffer pour réduire la surcharge des paquets réseau
        const processor = audioContext.createScriptProcessor(8192, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          // Utiliser un buffer plus compact si possible, mais ici on reste en Int16
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // Clipping simple pour éviter les distorsions
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('audio-data', int16Data.buffer);
          }
        };

        mixedOutput.connect(processor);
        processor.connect(audioContext.destination);

        if (socketRef.current) socketRef.current.emit("start-stream", showTitle);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Impossible d'accéder au microphone.");
      }
    } else {
      stopAll();
    }
  };

  const stopAll = () => {
    setIsPlaylistPlaying(false);
    isPlaylistPlayingRef.current = false;
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (musicSourceRef.current) {
      musicSourceRef.current.onended = null;
      musicSourceRef.current.stop();
    }
    if (audioContextRef.current) audioContextRef.current.close();
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setIsLive(false);
    if (socketRef.current) socketRef.current.emit("stop-stream");
  };

  const playNextTrack = async (indexOverride = -1) => {
    const currentPlaylist = playlistRef.current;
    if (currentPlaylist.length === 0) return;
    if (!audioContextRef.current) return;
    
    let nextIndex;
    if (indexOverride !== -1) {
      nextIndex = indexOverride;
    } else {
      nextIndex = (currentTrackIndexRef.current + 1) % currentPlaylist.length;
    }
    
    setCurrentTrackIndex(nextIndex);
    currentTrackIndexRef.current = nextIndex;
    
    try {
      const track = currentPlaylist[nextIndex];
      const response = await fetch(track.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      if (musicSourceRef.current) {
        musicSourceRef.current.onended = null;
        try { musicSourceRef.current.stop(); } catch(e) {}
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(musicGainNodeRef.current);
      
      source.onended = () => {
        if (isPlaylistPlayingRef.current) {
          playNextTrack();
        }
      };

      source.start(0);
      musicSourceRef.current = source;
      setIsPlaylistPlaying(true);
    } catch (e) {
      console.error("Error playing track:", e);
      // En cas d'erreur, on tente de passer au suivant après un court délai
      if (isPlaylistPlayingRef.current) {
        setTimeout(() => playNextTrack(), 1000);
      }
    }
  };

  const updateSchedule = () => {
    if (newScheduleItem.time && newScheduleItem.title) {
      const updated = [...schedule, newScheduleItem].sort((a, b) => a.time.localeCompare(b.time));
      setSchedule(updated);
      if (socketRef.current) socketRef.current.emit("update-schedule", updated);
      setNewScheduleItem({ time: "", title: "", host: "" });
    }
  };

  const removeScheduleItem = (index) => {
    const updated = schedule.filter((_, i) => i !== index);
    setSchedule(updated);
    if (socketRef.current) socketRef.current.emit("update-schedule", updated);
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
                <h3>Régie Musicale (Auto-DJ)</h3>
                <p>{playlist.length} morceaux en attente</p>
              </div>
            </div>
            
            <div className={styles.playlistControls}>
              <input 
                type="file" 
                multiple 
                accept="audio/*" 
                onChange={handleFileUpload}
                id="music-upload"
                hidden
              />
              <label htmlFor="music-upload" className={styles.secondaryBtn}>
                + Ajouter des MP3
              </label>
              
              {playlist.length > 0 && (
                <button 
                  className={`${styles.playBtn} ${isPlaylistPlaying ? styles.stopBtn : styles.startBtn}`}
                  onClick={async () => {
                    if (!isLive) {
                      await toggleLive(true); // Démarrer en Mute par défaut
                      setTimeout(() => playNextTrack(), 500);
                    } else {
                      if (isPlaylistPlaying) {
                        setIsPlaylistPlaying(false);
                        if (musicSourceRef.current) {
                          musicSourceRef.current.onended = null;
                          musicSourceRef.current.stop();
                        }
                      } else {
                        playNextTrack();
                      }
                    }
                  }}
                >
                  {isPlaylistPlaying ? "Arrêter la Musique" : (!isLive ? "Démarrer Direct + Musique" : "Lancer la Playlist")}
                </button>
              )}
            </div>
            
            <div className={styles.playlistScroll}>
              {playlist.map((track, i) => (
                <div key={i} className={`${styles.playlistItem} ${currentTrackIndex === i ? styles.activeTrack : ""}`}>
                  <span className={styles.trackNumber}>{i + 1}</span>
                  <span className={styles.trackName}>{track.name}</span>
                  {currentTrackIndex === i && isPlaylistPlaying && <div className={styles.playingDot} />}
                </div>
              ))}
              {playlist.length === 0 && <p className={styles.emptyHint}>Glissez vos fichiers ici pour créer une playlist</p>}
            </div>
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
              <p className={styles.hint}>Qualité : 16kHz Mono PCM (~256kbps)</p>
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
