import { createApp } from 'https://unpkg.com/petite-vue?module'; // Import module version
import * as socket from './socket.js';
import * as canvas from './canvas.js';
import * as constants from './constants.js';
import * as uiInteractions from './uiInteractions.js'; // Keep for toggling sections for now

const { VIEWS, SOCKET_EVENTS, DEFAULT_SCORE_GOAL } = constants;

// Define the main reactive application state and methods
const appState = {
    // --- State Properties ---
    currentView: VIEWS.INITIAL_SETUP,
    // Input Models
    playerNameInput: '',
    roomIdInput: '',
    lobbyScoreGoalInput: DEFAULT_SCORE_GOAL,
    chatInput: '',
    guessInput: '',
    // App State
    player: null, // { id, name, score }
    room: null, // { id, players: [], hostId, settings: { scoreGoal }, gameState? }
    setupError: null, // { message: string }
    messages: [], // { sender, message, type }
    currentWord: null, // { script, latin } - for drawer
    isDrawing: false,
    timeLeft: 0,
    notification: null, // { message, type, timeoutId }
    // Canvas State (might be managed more directly by canvas.js, but useful here)
    currentColor: '#000000',
    brushSize: 3,
    // UI State
    isScoreboardVisible: false,
    isDrawingVisible: true,
    isChatVisible: true,

    // --- Computed Properties (Getters) ---
    get isHost() {
        return this.player?.id === this.room?.hostId;
    },
    get canStartGame() {
        return this.isHost && this.room?.players?.length >= 2;
    },
    get playersSorted() {
        // Basic sort, could be more complex
        return this.room?.players?.slice().sort((a, b) => b.score - a.score) || [];
    },
    get teamScore() {
        return this.room?.players?.reduce((sum, p) => sum + p.score, 0) || 0;
    },

    // --- Methods (Event Handlers) ---
    showError(message, isSetupError = false) {
        console.error("Error:", message);
        if (isSetupError) {
            this.setupError = { message };
        } else {
            this.showNotification(message, 'error');
        }
    },
    clearError() {
        this.setupError = null;
    },
    showNotification(message, type = 'info', duration = 3000) {
        if (this.notification?.timeoutId) {
            clearTimeout(this.notification.timeoutId);
        }
        const timeoutId = setTimeout(() => {
            this.notification = null;
        }, duration);
        this.notification = { message, type, timeoutId };
    },
    resetState() {
        this.player = null;
        this.room = null;
        this.isDrawing = false;
        this.currentWord = null;
        this.messages = [];
        this.timeLeft = 0;
        this.lobbyScoreGoalInput = DEFAULT_SCORE_GOAL;
        this.clearError();
        // Don't reset inputs automatically, user might want to retry
    },
    createRoom() {
        this.clearError();
        const name = this.playerNameInput.trim();
        if (!name) {
            this.showError("Please enter your name.", true);
            return;
        }
        console.log(`Player ${name} attempting to create room...`);
        this.connectAndEmit(SOCKET_EVENTS.CREATE_ROOM, { playerName: name });
    },
    joinRoom() {
        this.clearError();
        const name = this.playerNameInput.trim();
        const roomId = this.roomIdInput.trim().toUpperCase();
        if (!name) {
            this.showError("Please enter your name.", true);
            return;
        }
        if (!roomId || roomId.length !== 4) {
            this.showError("Please enter a valid 4-digit room code.", true);
            return;
        }
        console.log(`Player ${name} attempting to join room ${roomId}...`);
        this.connectAndEmit(SOCKET_EVENTS.JOIN_ROOM, roomId, name);
    },
    leaveRoom() {
        console.log("Leaving room...");
        socket.disconnect(); // Server handles cleanup on disconnect
        this.resetState();
        this.currentView = VIEWS.INITIAL_SETUP;
        canvas.clearCanvas();
        canvas.setDrawingEnabled(false);
    },
    startGame() {
        if (!this.canStartGame) return;
        const goal = parseInt(this.lobbyScoreGoalInput, 10);
        if (isNaN(goal) || goal < 10) {
            this.showNotification("Please set a valid score goal (minimum 10).", "error");
            return;
        }
        console.log(`Host requesting to start game with score goal: ${goal}`);
        socket.emit(SOCKET_EVENTS.START_GAME, this.room.id, goal);
    },
    sendMessage() {
        const message = this.chatInput.trim();
        if (message && this.room) {
            socket.emit(SOCKET_EVENTS.SEND_MESSAGE, this.room.id, message);
            this.chatInput = ''; // Clear input
        }
    },
    sendGuess() {
        const guess = this.guessInput.trim();
        if (guess && this.room && !this.isDrawing) {
            socket.emit(SOCKET_EVENTS.SEND_GUESS, this.room.id, guess);
            this.guessInput = ''; // Clear input
        }
    },
    clearCanvasClick() {
        if (this.room && this.isDrawing) {
            socket.emit(SOCKET_EVENTS.CLEAR_CANVAS, this.room.id);
            // Server broadcasts update to all, including drawer
        }
    },
    // Basic toggle implementations - uiInteractions could be removed if not needed elsewhere
    toggleScoreboard() {
        this.isScoreboardVisible = !this.isScoreboardVisible;
        // Could use uiInteractions.toggleScoreboard if it does more complex things
    },
    toggleSection(sectionId) {
         if (sectionId === 'drawing-content') this.isDrawingVisible = !this.isDrawingVisible;
         if (sectionId === 'chat-content') this.isChatVisible = !this.isChatVisible;
        // Could use uiInteractions.toggleSection if it does more complex things
    },
    // Canvas interaction handlers (called from @input)
    handleColorChange(event) {
        this.currentColor = event.target.value;
        canvas.setCurrentColor(this.currentColor);
    },
    handleBrushSizeChange(event) {
        this.brushSize = event.target.value;
        canvas.setBrushSize(this.brushSize);
    },

    // --- Socket Connection Helper ---
    connectAndEmit(event, ...args) {
        const isReconnect = socket.isConnected(); // Check if already connected
        if (isReconnect) {
             console.log("Socket already connected, emitting directly:", event);
             this._emitWithAcknowledgement(event, ...args);
        } else {
            console.log("Connecting socket before emitting:", event);
            socket.connect();

            const handleConnect = () => {
                console.log("Socket connected, now emitting:", event);
                this._emitWithAcknowledgement(event, ...args);
                removeConnectListeners();
            };
            const handleConnectError = (error) => {
                console.error(`Failed to connect for ${event}:`, error);
                this.showError(`Failed to connect: ${error.message || 'Unknown error'}`, true);
                this.resetState();
                removeConnectListeners();
            };
            const removeConnectListeners = () => {
                socket.off('connect', handleConnect);
                socket.off('connect_error', handleConnectError);
            };
            socket.on('connect', handleConnect);
            socket.on('connect_error', handleConnectError);
        }
    },

    // Helper for emitting events that expect an acknowledgement callback
    _emitWithAcknowledgement(event, ...args) {
        const potentialId = socket.getSocketId();
        if (!potentialId) {
            this.showError("Connected, but failed to get session ID. Please try again.", true);
            socket.disconnect();
            this.resetState();
            return;
        }
         // Update player state immediately if not already set (important for CREATE_ROOM)
        if (!this.player || !this.player.id) {
             this.player = { name: this.playerNameInput.trim(), id: potentialId, score: 0 };
        }


        // Prepare arguments for emit, including the callback
        const emitArgs = [];
        let payload = {}; // Default payload

        if (event === SOCKET_EVENTS.CREATE_ROOM) {
            payload = { playerName: this.player.name, playerId: this.player.id };
            emitArgs.push(payload);
        } else if (event === SOCKET_EVENTS.JOIN_ROOM) {
            const [roomId, playerName] = args; // Extract original args
            payload = { roomId, playerName, playerId: this.player.id }; // Server expects roomId, playerName
            emitArgs.push(roomId, playerName); // Pass original args expected by server
        } else {
             // For other events if needed, assume args[0] is the main payload
             if(args.length > 0) emitArgs.push(args[0]);
        }


        // Add the acknowledgement callback
        emitArgs.push((response) => {
            console.log(`${event} response:`, response);
            if (response.success) {
                // Update state based on successful room creation/join
                this.room = {
                    id: response.roomId,
                    players: response.players,
                    hostId: response.hostId,
                    settings: { scoreGoal: this.lobbyScoreGoalInput } // Use current input value
                };
                this.player = response.players.find(p => p.id === this.player.id) || this.player; // Update player score if needed
                this.currentView = VIEWS.LOBBY;
                this.registerSocketListeners(); // Register persistent listeners *after* success
            } else {
                this.showError(response.message || `Failed to ${event}.`, true);
                socket.disconnect(); // Disconnect on failure
                this.resetState();
            }
        });

        // Emit the event
        socket.emit(event, ...emitArgs);
    },


    // --- Socket Event Listeners Setup ---
    registerSocketListeners() {
        console.log("Registering persistent socket listeners...");
        // Remove potential old listeners before adding new ones (important for reconnects/rejoins)
        socket.off(SOCKET_EVENTS.ROOM_UPDATE);
        socket.off(SOCKET_EVENTS.PLAYER_LEFT);
        socket.off(SOCKET_EVENTS.NEW_HOST);
        socket.off(SOCKET_EVENTS.GAME_STARTED);
        socket.off(SOCKET_EVENTS.NEW_TURN);
        socket.off(SOCKET_EVENTS.YOUR_TURN_TO_DRAW);
        socket.off(SOCKET_EVENTS.DRAWING_UPDATE);
        socket.off(SOCKET_EVENTS.CLEAR_CANVAS_UPDATE);
        socket.off(SOCKET_EVENTS.CHAT_MESSAGE);
        socket.off(SOCKET_EVENTS.GUESS_RESULT);
        socket.off(SOCKET_EVENTS.SCORE_UPDATE);
        socket.off(SOCKET_EVENTS.TIMER_UPDATE);
        socket.off(SOCKET_EVENTS.GAME_OVER);
        socket.off(SOCKET_EVENTS.ERROR);
        socket.off(SOCKET_EVENTS.DISCONNECT);
        // connect_error is handled per-action

        // --- Add new listeners ---
        socket.on(SOCKET_EVENTS.ROOM_UPDATE, (data) => {
            console.log("Socket: ROOM_UPDATE", data);
            if (this.room && this.room.id === data.roomId) {
                this.room.players = data.players;
                this.room.hostId = data.hostId;
                // Update current player data from the list
                 const updatedSelf = data.players.find(p => p.id === this.player?.id);
                 if (updatedSelf) this.player = { ...updatedSelf };
            }
        });
        socket.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
             console.log("Socket: PLAYER_LEFT", data);
             this.messages.push({ sender: 'System', message: `${data.playerName} left the room.`, type: 'system' });
             // ROOM_UPDATE will handle the list change
        });
         socket.on(SOCKET_EVENTS.NEW_HOST, (data) => {
             console.log("Socket: NEW_HOST", data);
             if (this.room) {
                 this.room.hostId = data.hostId;
                 this.messages.push({ sender: 'System', message: `${data.hostName} is now the host.`, type: 'system' });
             }
        });
        socket.on(SOCKET_EVENTS.GAME_STARTED, (data) => {
            console.log("Socket: GAME_STARTED", data);
             if (this.room) {
                 this.room.settings.scoreGoal = data.scoreGoal;
                 this.currentView = VIEWS.GAME_AREA;
                 this.messages = []; // Clear messages for new game
                 this.isScoreboardVisible = false; // Reset UI state
                 this.isDrawingVisible = true;
                 this.isChatVisible = true;
                 // Ensure canvas element is passed if initCanvas needs it
                 const canvasEl = document.getElementById('drawing-canvas'); // Get canvas element when needed
                 if (canvasEl) {
                    // Pass canvas element and room ID to initCanvas
                    canvas.initCanvas(canvasEl, this.room.id);
                    // Set initial canvas state from appState
                    canvas.setCurrentColor(this.currentColor);
                    canvas.setBrushSize(this.brushSize);
                    canvas.clearCanvas();
                 } else {
                    console.error("Drawing canvas element not found for init!");
                 }
             }
        });
        socket.on(SOCKET_EVENTS.NEW_TURN, (data) => {
            console.log("Socket: NEW_TURN", data);
             if (this.room && this.player) {
                 this.isDrawing = this.player.id === data.drawerId;
                 this.currentWord = null; // Reset word
                 this.timeLeft = data.timeLeft;
                 canvas.setDrawingEnabled(this.isDrawing);
                 canvas.clearCanvas();
                 this.guessInput = ''; // Clear guess input
                 this.messages.push({ sender: 'System', message: `${data.drawerName} is drawing!`, type: 'system' });
                 // Update top bar drawer name directly if needed, or rely on computed property + HTML binding
             }
        });
        socket.on(SOCKET_EVENTS.YOUR_TURN_TO_DRAW, (data) => {
             console.log("Socket: YOUR_TURN_TO_DRAW", data);
             this.currentWord = data.word;
        });
        socket.on(SOCKET_EVENTS.DRAWING_UPDATE, canvas.handleIncomingDrawData);
        socket.on(SOCKET_EVENTS.CLEAR_CANVAS_UPDATE, canvas.clearCanvas);
        socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data) => {
             console.log("Socket: CHAT_MESSAGE", data);
             this.messages.push({ sender: data.sender, message: data.message, type: data.type || 'chat' });
             // Auto-scroll handled by HTML/CSS or a small directive later if needed
        });
        socket.on(SOCKET_EVENTS.GUESS_RESULT, (data) => {
             console.log("Socket: GUESS_RESULT", data);
             if (data.isCorrect) {
                 this.messages.push({ sender: data.playerName, message: `guessed the word! (+${data.pointsAwarded} points)`, type: 'correct-guess' });
             }
             // Incorrect guesses are just normal chat messages from server
        });
        socket.on(SOCKET_EVENTS.SCORE_UPDATE, (data) => {
             console.log("Socket: SCORE_UPDATE", data);
             if (this.room) {
                 this.room.players = data.players;
                 // Update self from list
                 const updatedSelf = data.players.find(p => p.id === this.player?.id);
                 if (updatedSelf) this.player = { ...updatedSelf };
             }
        });
        socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data) => {
             // console.log("Socket: TIMER_UPDATE", data); // Can be noisy
             this.timeLeft = data.timeLeft;
        });
        socket.on(SOCKET_EVENTS.GAME_OVER, (data) => {
             console.log("Socket: GAME_OVER", data);
             this.isDrawing = false;
             this.currentWord = null;
             canvas.setDrawingEnabled(false);
             this.showNotification(`Game Over! ${data.reason}`, 'info', 5000);
             setTimeout(() => {
                 if (this.room && this.player) {
                     // Optionally reset scores in room.players here if desired
                     this.currentView = VIEWS.LOBBY;
                 } else {
                     this.currentView = VIEWS.INITIAL_SETUP; // Fallback
                 }
             }, 5000);
        });
        socket.on(SOCKET_EVENTS.ERROR, (data) => {
             console.error("Socket: ERROR", data);
             this.showError(`Server Error: ${data.message || 'Unknown error'}`);
        });
        socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
             console.log(`Socket: DISCONNECT`, reason);
             this.showNotification('Disconnected from server.', 'error');
             this.resetState();
             this.currentView = VIEWS.INITIAL_SETUP;
             canvas.clearCanvas();
             canvas.setDrawingEnabled(false);
        });
    },

    // Removed custom mount() method
};

// Create and mount the app AFTER appState is fully defined
createApp(appState).mount('#app-container');

console.log("petite-vue mounted to #app-container.");