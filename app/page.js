import Navbar from "@/components/Navbar";
import RadioPlayer from "@/components/RadioPlayer";
import Chat from "@/components/Chat";
import styles from "./page.module.css";
import { Calendar, Clock, Users, Heart } from "lucide-react";

export default function Home() {
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
            <RadioPlayer />
            <Chat />
          </div>
        </section>

        <section id="programmes" className={styles.features}>
          <div className={styles.grid}>
            <div className={`${styles.card} glass`}>
              <Calendar className={styles.cardIcon} />
              <h3>Programmation</h3>
              <p>Découvrez nos émissions quotidiennes et nos temps de prière en direct.</p>
            </div>
            <div className={`${styles.card} glass`}>
              <Clock className={styles.cardIcon} />
              <h3>24h/24 & 7j/7</h3>
              <p>Une présence spirituelle constante pour vous accompagner à chaque instant.</p>
            </div>
            <div className={`${styles.card} glass`}>
              <Users className={styles.cardIcon} />
              <h3>Communauté</h3>
              <p>Rejoignez des milliers d'auditeurs partageant la même foi à travers le monde.</p>
            </div>
            <div className={`${styles.card} glass`}>
              <Heart className={styles.cardIcon} />
              <h3>Soutien</h3>
              <p>Aidez-nous à diffuser la parole et à maintenir cette radio indépendante.</p>
            </div>
          </div>
        </section>

        <section className={styles.schedule}>
          <h2 className={styles.sectionTitle}>À Venir Aujourd'hui</h2>
          <div className={styles.scheduleList}>
            {[
              { time: "08:00", title: "Matines & Prières du Matin", host: "Père Jean" },
              { time: "12:00", title: "Chants Liturgiques", host: "Chœur de la Cathédrale" },
              { time: "18:00", title: "Vêpres de la Paix", host: "Père Marc" },
              { time: "21:00", title: "Méditation Nocturne", host: "Sœur Marie" },
            ].map((item, i) => (
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
