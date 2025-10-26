import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// Debug socket connection
socket.on("connect", () => {
  console.log("Socket.IO Connected");
  console.log("Socket ID:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Socket.IO Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.log("Socket.IO Connection Error:", error);
});

export default socket;
