"use client";
import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import RadioPlayer from "@/components/RadioPlayer";
import Chat from "@/components/Chat";
import styles from "./page.module.css";
import { io } from "socket.io-client";
import { Calendar, Clock, Users, Heart } from "lucide-react";

export default function Home() {
  const socketRef = useRef(null);
  const [currentShow, setCurrentShow] = useState("RTO");
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    
    socket.on("current-show", (title) => setCurrentShow(title));
    socket.on("update-schedule", (newSchedule) => setSchedule(newSchedule));

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      <Navbar />
      
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>Radio Toamasina Orthodoxe</h1>
            <p className={styles.tagline}>La Voix de la Foi, l'Écho de la Paix</p>
            <div className={styles.divider}></div>
            <p className={styles.description}>
              Une immersion spirituelle quotidienne à travers la musique sacrée, 
              les enseignements et la prière. Rejoignez notre communauté universelle.
            </p>
          </div>
        </section>

        <section className={styles.playerSection}>
          <div className={styles.playerGrid}>
            <RadioPlayer currentShow={currentShow} />
            <Chat />
          </div>
        </section>

        <section id="programmes" className={styles.schedule}>
          <h2 className={styles.sectionTitle}>À Venir Aujourd'hui</h2>
          <div className={styles.scheduleList}>
            {schedule.map((item, i) => (
              <div key={i} className={styles.scheduleItem}>
                <span className={styles.time}>{item.time}</span>
                <div className={styles.scheduleInfo}>
                  <h4>{item.title}</h4>
                  <p>{item.host}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerInfo}>
            <p>© 2026 RTO - Radio Toamasina Orthodoxe</p>
            <p>La Voix de la Foi, l'Écho de la Paix</p>
          </div>
          <div className={styles.footerContact}>
            <p>Contact : <a href="mailto:contact@rto.mg">contact@rto.mg</a></p>
            <p>Tél : +261 34 64 813 55</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
