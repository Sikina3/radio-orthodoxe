"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import RadioPlayer from "@/components/RadioPlayer";
import Chat from "@/components/Chat";
import styles from "./page.module.css";
import { io } from "socket.io-client";
import { Calendar, Clock, Users, Heart } from "lucide-react";

export default function Home() {
  const [currentShow, setCurrentShow] = useState("Radio Orthodoxe");
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const socket = io();
    
    socket.on("current-show", (title) => setCurrentShow(title));
    socket.on("update-schedule", (newSchedule) => setSchedule(newSchedule));

    return () => socket.disconnect();
  }, []);

  return (
    <div className={styles.container}>
      <Navbar />
      
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>Radio Orthodoxe</h1>
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
          <p>© 2026 Radio Orthodoxe. Tous droits réservés.</p>
          <div className={styles.footerLinks}>
            <a href="#">Confidentialité</a>
            <a href="#">Conditions</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
