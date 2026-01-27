"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import { Lock, Radio } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simple hardcoded password for personal use
    if (password === "orthodoxe2026") {
      localStorage.setItem("admin_auth", "true");
      router.push("/admin");
    } else {
      setError("Mot de passe incorrect");
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.loginBox} glass`}>
        <div className={styles.header}>
          <Radio className={styles.logo} />
          <h1>Radio Orthodoxe</h1>
          <p>Accès Administrateur</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <Lock className={styles.icon} />
            <input 
              type="password" 
              placeholder="Mot de passe" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submitBtn}>
            Se Connecter
          </button>
        </form>
      </div>
    </div>
  );
}
