"use client";
import Link from "next/link";
import { Radio } from "lucide-react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <Radio className={styles.icon} />
          <span>RTO</span>
        </Link>
        <div className={styles.links}>
          <Link href="#programmes">Programmes</Link>
          <Link href="#a-propos">À Propos</Link>
          <Link href="#contact">Contact</Link>
          <Link href="/admin" className={styles.adminBtn}>Admin</Link>
        </div>
      </div>
    </nav>
  );
}
