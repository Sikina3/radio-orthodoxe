const { io } = require("socket.io-client");

const socket = io("http://localhost:3000", { transports: ["websocket"] });

const SAMPLE_RATE = 22050;
const CHUNK_SAMPLES = 2048; // ~0.093s per chunk
const FREQUENCY = 440;

socket.on("connect", () => {
  console.log("Connected as test-admin", socket.id);
  socket.emit("start-stream", { title: "Test Stream", config: { sampleRate: SAMPLE_RATE } });

  let t = 0;
  const sendChunk = () => {
    const int16 = new Int16Array(CHUNK_SAMPLES);
    for (let i = 0; i < CHUNK_SAMPLES; i++) {
      const sample = Math.sin((2 * Math.PI * FREQUENCY * (t + i)) / SAMPLE_RATE);
      int16[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }

    // send as Buffer (binary)
    socket.emit("audio-data", Buffer.from(int16.buffer));

    t += CHUNK_SAMPLES;
  };

  // send at real-time pace
  const interval = (CHUNK_SAMPLES / SAMPLE_RATE) * 1000;
  console.log(`Streaming test tone: ${FREQUENCY}Hz, chunk ${CHUNK_SAMPLES} samples, interval ${interval.toFixed(1)}ms`);

  const id = setInterval(sendChunk, interval);

  // stop after 30s
  setTimeout(() => {
    clearInterval(id);
    socket.emit("stop-stream");
    socket.close();
    console.log("Test stream finished");
    process.exit(0);
  }, 30_000);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});
