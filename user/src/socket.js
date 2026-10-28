import { io } from "socket.io-client";
import tenant, { resolved } from "./tenant";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const socket = io(SERVER_URL, {
    transports: ["websocket"],   // websocket only, no polling fallback causing double-fire
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    upgrade: false,              // prevent transport upgrade re-connection
});

// Join this restaurant's guest room (and venue) on every (re)connect, so a
// customer only ever receives their own restaurant's live updates.
function joinRoom() {
    if (tenant.restaurant) {
        socket.emit("guest:join", { restaurant: tenant.restaurant, venue: tenant.venue || undefined });
    }
}
socket.on("connect", joinRoom);
export { joinRoom };

export default socket;

//------------------------------------user panel---------------------------------------------