"use client";
import { useState, useEffect, useRef } from "react";
import { Send, User } from "lucide-react";
import styles from "./Chat.module.css";
import { io } from "socket.io-client";

export default function Chat() {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsJoined(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && isJoined && socketRef.current) {
      const msg = {
        text: input,
        user: username,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Math.random().toString(36).substr(2, 9)
      };
      socketRef.current.emit("send-chat-message", msg);
      setMessages((prev) => [...prev, msg]);
      setInput("");
    }
  };

  if (!isJoined) {
    return (
      <div className={`${styles.joinContainer} glass`}>
        <h3>Rejoindre le Chat</h3>
        <form onSubmit={handleJoin} className={styles.joinForm}>
          <input 
            type="text" 
            placeholder="Votre pseudo..." 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            required
          />
          <button type="submit">Rejoindre</button>
        </form>
      </div>
    );
  }

  return (
    <div className={`${styles.chatContainer} glass`}>
      <div className={styles.header}>
        <h3>Chat en Direct</h3>
      </div>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.message}>
            <span className={styles.user}>{msg.user}</span>
            <span className={styles.time}>{msg.time}</span>
            <p className={styles.text}>{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className={styles.inputArea}>
        <input 
          type="text" 
          placeholder="Écrivez un message..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
        />
        <button type="submit">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
