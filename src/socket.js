// import io from '/socket.io/socket.io.js'; // Assuming Socket.IO client is loaded globally via script tag in HTML

let socket = null;
let socketId = null; // Store the ID locally

/**
 * Establishes connection to the Socket.IO server.
 * Needs to be called explicitly, e.g., after getting player name/room.
 */
export function connect() {
    if (socket && socket.connected) {
        console.log("Already connected.");
        return;
    }

    // Connect to the server (adjust URL if needed, default is same origin)
    // Use 'io()' which should be globally available from the script tag
    try {
        // @ts-ignore - io is loaded globally
        socket = io({
            // Optional: Add connection options if needed
            // e.g., transports: ['websocket']
        });
        console.log("Attempting to connect to socket server...");
        setupEventListeners();
    } catch (error) {
        console.error("Socket.IO client (io) not found. Make sure the script is loaded.", error);
        // Show error to user?
    }
}

/** Disconnects from the server. */
export function disconnect() {
    if (socket) {
        console.log("Disconnecting from socket server...");
        socket.disconnect();
        socket = null;
    }
}

/**
 * Emits an event to the server.
 * @param {string} eventName - The name of the event.
 * @param {...any} args - Data and optional callback function to send.
 */
export function emit(eventName, ...args) { // Use rest parameter
    if (socket && socket.connected) {
        // Log all arguments being sent
        console.log(`Emitting event: ${eventName}`, ...args);
        // Pass all arguments to the underlying socket.emit
        socket.emit(eventName, ...args);
    } else {
        console.error(`Socket not connected. Cannot emit event: ${eventName}`);
        // Handle error - maybe notify user or attempt reconnect?
    }
}

/**
 * Registers a listener for a specific server event.
 * @param {string} eventName - The name of the event to listen for.
 * @param {Function} callback - The function to execute when the event is received.
 */
export function on(eventName, callback) {
    if (socket) {
        socket.on(eventName, callback);
    } else {
        console.error(`Socket not initialized. Cannot register listener for: ${eventName}`);
    }
}

/**
 * Unregisters a listener for a specific server event.
 * @param {string} eventName - The name of the event.
 * @param {Function} callback - The specific callback function to remove.
 */
export function off(eventName, callback) {
    // If socket is already null (e.g., during disconnect cleanup), just return.
    if (!socket) {
        return;
    }
    socket.off(eventName, callback);
}

/** Returns the current socket ID if connected, otherwise null. */
export function getSocketId() {
    return socketId;
}

/** Sets up default Socket.IO event listeners. */
function setupEventListeners() {
    if (!socket) return;

    socket.on('connect', () => {
        socketId = socket.id; // Store the ID when connected
        console.log(`Connected to server with ID: ${socketId}`);
        // TODO: Handle successful connection (e.g., maybe emit join/create now?)
    });

    socket.on('disconnect', (reason) => {
        console.log(`Disconnected from server: ${reason}`);
        socketId = null; // Clear stored ID on disconnect
        // TODO: Handle disconnection (e.g., show error message, return to setup screen)
        // ui.showNotification('Disconnected from server.', 'error');
        // ui.showView(constants.VIEWS.INITIAL_SETUP); // Or a specific disconnected view
    });

    socket.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        // TODO: Handle connection errors (e.g., show error message)
        // ui.showNotification(`Failed to connect: ${error.message}`, 'error');
    });

    // --- Game Specific Listeners (Examples - To be implemented) ---
    // --- Game Specific Listeners ---
    // We will register these specifically in main.js after connecting
    // on('roomUpdate', handleRoomUpdate); // Example: Will be handled in main.js
    // on('gameStarted', handleGameStarted); // Example: Will be handled in main.js
    // on('newTurn', handleNextTurn); // Example: Will be handled in main.js
    // on('drawData', handleDrawDataReceive);
    // on('chatMessage', handleChatMessageReceive);
    // on('guessResult', handleGuessResult);
    // on('gameOver', handleGameOver);
    // on('error', handleErrorFromServer); // Generic error handler
}

// --- Placeholder Handlers (to be moved or implemented properly) ---
// --- Placeholder Handlers (These will likely live in main.js or be called from there) ---
// function handleRoomUpdate(data) { console.log('Room Updated:', data); /* Update UI */ }
// function handleGameStarted(data) { console.log('Game Started:', data); /* Update UI, switch view */ }
// function handleNextTurn(data) { console.log('Next Turn:', data); /* Update UI, canvas */ }
// function handleDrawDataReceive(data) { console.log('Draw Data Received'); /* Update canvas */ }
// function handleChatMessageReceive(data) { console.log('Chat Message:', data); /* Update UI */ }
// function handleGuessResult(data) { console.log('Guess Result:', data); /* Update UI */ }
// function handleGameOver(data) { console.log('Game Over:', data); /* Update UI */ }
// function handleErrorFromServer(data) { console.error('Server Error:', data); /* Show UI notification */ }