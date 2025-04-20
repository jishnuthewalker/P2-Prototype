import { createApp } from 'https://unpkg.com/petite-vue?module';
import * as socket from './socket.js';
import * as canvas from './canvas.js';
import * as constants from './constants.js';
import { populateHintModal } from './ui.js'; // Keep for initial population
import { makeDraggable } from './uiInteractions.js'; // Keep for modal dragging

const { VIEWS, SOCKET_EVENTS, DEFAULT_SCORE_GOAL } = constants;

// --- Main Application State and Logic (using petite-vue) ---
const appState = {
    // --- Reactive State Properties ---

    // Core App State
    currentView: VIEWS.INITIAL_SETUP,
    player: null, // { id, name, score }
    room: null,   // { id, players: [], hostId, settings: { scoreGoal }, gameState: { currentDrawerId, currentWordHint } }
    messages: [], // { sender, message, type }
    roomTeamScore: 0, // Team score directly from server

    // Game State Specific
    isDrawing: false,    // Is the current player the drawer?
    currentWord: null,   // { script, latin } - for drawer only
    timeLeft: 0,

    // Input Models (Bound to HTML inputs via v-model)
    playerNameInput: '',
    roomIdInput: '',
    lobbyScoreGoalInput: DEFAULT_SCORE_GOAL,
    chatInput: '',
    guessInput: '',

    // UI Control State
    setupError: null,     // { message: string } | null
    notification: null, // { message: string, type: string, timeoutId: number | null } | null
    isHintModalVisible: false, // Control hint modal visibility

    // Canvas Related State
    brushSize: 3,
    isDarkMode: false,

    // --- Computed Properties (Getters) ---

    /** Checks if the current player is the host of the room. */
    get isHost() {
        return this.player?.id === this.room?.hostId;
    },

    /** Checks if the game can be started (host, >= 2 players). */
    get canStartGame() {
        return this.isHost && this.room?.players?.length >= 2;
    },

    /** Returns the player list sorted alphabetically by name. */
    get playersSorted() {
        return this.room?.players?.slice().sort((a, b) => {
            const nameA = a.name.toUpperCase();
            const nameB = b.name.toUpperCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        }) || [];
    },

    /** Returns the current team score received from the server. */
    get teamScore() {
        return this.roomTeamScore || 0;
    },

    /** Gets the name of the current drawer, if any. */
    get currentDrawerName() {
        // Use gameState if available from server updates
        const drawerId = this.room?.gameState?.currentDrawerId;
        return this.room?.players?.find(p => p.id === drawerId)?.name || '...';
    },

    /** Calculates the team progress percentage for the progress bar. */
    get teamProgressPercentage() {
        const goal = this.room?.settings?.scoreGoal || this.lobbyScoreGoalInput || 1; // Avoid division by zero
        const progress = (this.teamScore / goal) * 100;
        return Math.min(100, Math.max(0, progress)); // Clamp between 0 and 100
    },

    // --- Methods ---

    // UI Feedback Methods
    showError(message, isSetupError = false) {
        console.error("Error:", message);
        if (isSetupError) {
            this.setupError = { message };
        } else {
            // Use notification for non-setup errors
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
        const newNotification = { message, type, timeoutId: null };
        this.notification = newNotification;

        const timeoutId = setTimeout(() => {
            if (this.notification === newNotification) {
               this.notification = null;
            }
        }, duration);
        newNotification.timeoutId = timeoutId;
    },

    // State Reset
    resetState() {
        console.log("Resetting client state...");
        this.player = null;
        this.room = null;
        this.isDrawing = false;
        this.currentWord = null;
        this.messages = [];
        this.timeLeft = 0;
        this.roomTeamScore = 0;
        this.lobbyScoreGoalInput = DEFAULT_SCORE_GOAL;
        this.clearError();
        // Keep playerNameInput, roomIdInput
    },

    // Core Actions (Setup & Lobby) - Called from HTML via @click
    createRoom() {
        this.clearError();
        const name = this.playerNameInput.trim();
        if (!name) {
            return this.showError("Please enter your name.", true);
        }
        console.log(`Player ${name} attempting to create room...`);
        // Player object is created/updated in _emitWithAcknowledgement callback
        // Pass player name directly, ID will be handled by socket connection
        this.connectAndEmit(SOCKET_EVENTS.CREATE_ROOM, { playerName: name });
    },
    joinRoom() {
        this.clearError();
        const name = this.playerNameInput.trim();
        const roomId = this.roomIdInput.trim().toUpperCase();
        if (!name) {
            return this.showError("Please enter your name.", true);
        }
        if (!roomId || roomId.length !== 4) {
            return this.showError("Please enter a valid 4-digit room code.", true);
        }
        console.log(`Player ${name} attempting to join room ${roomId}...`);
        // Player object is created/updated in _emitWithAcknowledgement callback
        this.connectAndEmit(SOCKET_EVENTS.JOIN_ROOM, roomId, name);
    },
    leaveRoom() {
        console.log("Leaving room...");
        socket.disconnect(); // Server handles cleanup via disconnect event
        this.resetState();
        this.currentView = VIEWS.INITIAL_SETUP;
        canvas.clearCanvas();
        canvas.setDrawingEnabled(false);
    },
    startGame() {
        if (!this.canStartGame) {
             this.showNotification("Only the host can start the game, and you need at least 2 players.", "warning");
             return;
        }
        const goal = parseInt(this.lobbyScoreGoalInput, 10);
        if (isNaN(goal) || goal < 10) {
            return this.showNotification("Please set a valid score goal (minimum 10).", "error");
        }
        console.log(`Host requesting to start game in room ${this.room?.id} with score goal: ${goal}`);
        socket.emit(SOCKET_EVENTS.START_GAME, this.room.id, goal);
        // View transition happens on GAME_STARTED event from server
    },

    // In-Game Actions - Called from HTML via @click/@submit
    sendMessage() {
        const message = this.chatInput.trim();
        if (message && this.room) {
            socket.emit(SOCKET_EVENTS.SEND_MESSAGE, this.room.id, message);
            this.chatInput = ''; // Clear input via v-model binding
        }
    },
    sendGuess() {
        const guess = this.guessInput.trim();
        if (guess && this.room && !this.isDrawing) { // Don't allow drawer to guess
            console.log(`Sending guess: '${guess}' for room ${this.room.id}`);
            socket.emit(SOCKET_EVENTS.SEND_GUESS, this.room.id, guess);
            this.guessInput = ''; // Clear input via v-model binding
        }
    },
    clearCanvasClick() {
        if (this.room && this.isDrawing) {
            socket.emit(SOCKET_EVENTS.CLEAR_CANVAS, this.room.id);
            // Canvas clears locally via CLEAR_CANVAS_UPDATE broadcast
        }
    },

    // Canvas Event Handlers - Called from HTML via @input
    handleBrushSizeChange(event) {
        this.brushSize = event.target.value;
        canvas.setBrushSize(this.brushSize);
    },

    // Dark Mode Logic
    initDarkMode() {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const storedPreference = localStorage.getItem('darkMode');
        if (storedPreference === 'true') {
            this.isDarkMode = true;
        } else if (storedPreference === 'false') {
            this.isDarkMode = false;
        } else {
            this.isDarkMode = prefersDark;
        }
        this.applyDarkMode(); // Apply initial theme
    },
    applyDarkMode() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        }
        // Set canvas drawing color based on theme
        const drawingColor = this.isDarkMode ? '#FFFFFF' : '#000000';
        canvas.setCurrentColor(drawingColor);
    },
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        this.applyDarkMode();
    },

    // Hint Modal Logic - Called from HTML via @click
    toggleHintModal() {
        this.isHintModalVisible = !this.isHintModalVisible;
        // Populate the modal content when it's shown
        if (this.isHintModalVisible) {
            // Use $nextTick to ensure the modal element is in the DOM before populating
            this.$nextTick(() => {
                 console.log("Populating hint modal and initializing drag..."); // DEBUG
                 populateHintModal('hint-modal-content'); // Use the correct ID from HTML

                 // Initialize dragging after modal content is potentially rendered
                 const hintModal = document.getElementById('hint-modal-draggable');
                 const hintHeader = document.getElementById('hint-modal-header');
                 if (hintModal && hintHeader) {
                     try {
                         makeDraggable(hintModal, hintHeader);
                         console.log("Hint modal drag initialized.");
                     } catch (error) {
                         console.error("Error initializing hint modal drag:", error);
                     }
                 } else {
                    console.warn("Could not find hint modal or header elements for dragging inside nextTick.");
                 }
            });
        }
    },

    // --- Socket Connection and Emission Logic ---

    /** Connects if necessary, then emits an event expecting an acknowledgement. */
    connectAndEmit(event, ...args) {
        if (socket.connected) {
             console.log(`Socket already connected, emitting ${event} directly.`);
             this._emitWithAcknowledgement(event, ...args);
        } else {
            console.log(`Connecting socket before emitting ${event}...`);
            socket.connect(); // Attempt connection

            const handleConnect = () => {
                console.log(`Socket connected for ${event}, now emitting.`);
                this._emitWithAcknowledgement(event, ...args);
                removeConnectListeners();
            };
            const handleConnectError = (error) => {
                console.error(`Failed to connect for ${event}:`, error);
                this.showError(`Failed to connect: ${error.message || 'Unknown error'}`, true);
                this.resetState(); // Reset state on connection failure
                removeConnectListeners();
            };
            const removeConnectListeners = () => {
                socket.off('connect', handleConnect);
                socket.off('connect_error', handleConnectError);
            };

            // Add temporary listeners for this connection attempt
            socket.on('connect', handleConnect);
            socket.on('connect_error', handleConnectError);
        }
    },

    /** Internal helper to structure and send events expecting acknowledgement. */
    _emitWithAcknowledgement(event, ...args) {
        const socketId = socket.getSocketId();
        if (!socketId) {
            console.error("Socket connected, but ID is not available. Aborting emit.");
            this.showError("Connection error: Missing session ID. Please try again.", true);
            socket.disconnect();
            this.resetState();
            return;
        }

        // Ensure player object exists with the correct ID before emitting
        // Use playerNameInput as the source of truth for name if player object doesn't exist yet
        const currentName = this.player?.name || this.playerNameInput.trim() || 'Player';
        if (!this.player || this.player.id !== socketId || this.player.name !== currentName) {
             console.log(`Updating player object. ID: ${socketId}, Name: ${currentName}`);
             this.player = { name: currentName, id: socketId, score: 0 };
        }

        const emitArgs = [];
        let payload = {};

        // Structure payload based on event type
        if (event === SOCKET_EVENTS.CREATE_ROOM) {
            // Server expects { playerName, playerId }
            payload = { playerName: this.player.name, playerId: this.player.id };
            emitArgs.push(payload);
        } else if (event === SOCKET_EVENTS.JOIN_ROOM) {
            // Server expects roomId, playerName
            const [roomId, playerName] = args; // playerName here is from input, used for server lookup/validation
            emitArgs.push(roomId, playerName);
        } else {
             // Handle other potential ack events if needed
             console.warn(`Unhandled acknowledgement event type: ${event}`);
             if(args.length > 0) emitArgs.push(...args); // Pass original args if not create/join
        }

        // Add the acknowledgement callback function as the last argument
        emitArgs.push((response) => {
            console.log(`Response for ${event}:`, response);
            if (response.success) {
                // Update local state based on successful room creation/join
                this.room = {
                    id: response.roomId,
                    players: response.players,
                    hostId: response.hostId,
                    settings: { scoreGoal: response.settings?.scoreGoal || this.lobbyScoreGoalInput },
                    gameState: response.gameState || null // Include initial gameState if provided
                };
                // Ensure local player object is updated with data from server (like initial score)
                this.player = response.players.find(p => p.id === this.player.id) || this.player;
                this.currentView = VIEWS.LOBBY; // Switch view
                this.registerSocketListeners(); // Register persistent listeners *after* successful join/create

                // --- Clipboard Copy Logic (Integrated) ---
                if (event === SOCKET_EVENTS.CREATE_ROOM) {
                    const roomIdToCopy = response.roomId;
                    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        navigator.clipboard.writeText(roomIdToCopy).then(() => {
                            console.log(`Room ID ${roomIdToCopy} copied to clipboard.`);
                            this.showNotification(`Room code ${roomIdToCopy} copied!`, 'success', 2500);
                        }).catch(err => {
                            console.error('Clipboard API Error: Failed to copy room ID automatically.', err);
                            this.showNotification(`Room ${roomIdToCopy} created. (Copy failed)`, 'info', 3000);
                        });
                    } else {
                        console.warn("Clipboard API (writeText) not available.");
                        this.showNotification(`Room ${roomIdToCopy} created. (Copy N/A)`, 'info', 3000);
                    }
                }
                 // --- End Clipboard Copy Logic ---

            } else {
                this.showError(response.message || `Failed to ${event === SOCKET_EVENTS.CREATE_ROOM ? 'create' : 'join'} room.`, true);
                socket.disconnect(); // Disconnect on failure
                this.resetState(); // Reset state but keep inputs
            }
        });

        // Emit the event with structured arguments and callback
        socket.emit(event, ...emitArgs);
    },


    // --- Socket Event Listener Registration ---

    /** Registers all persistent listeners for server events. Called ONCE after joining/creating a room. */
    registerSocketListeners() {
        // Prevent duplicate listeners if called multiple times
        if (this.listenersRegistered) {
            console.warn("Attempted to register socket listeners multiple times.");
            return;
        }
        console.log("Registering persistent socket listeners...");

        const eventHandlers = {
            [SOCKET_EVENTS.ROOM_UPDATE]: (data) => {
                console.log("Socket: ROOM_UPDATE", data);
                if (this.room && this.room.id === data.roomId) {
                    this.room.players = data.players;
                    this.room.hostId = data.hostId;
                    // Update self from list
                    const updatedSelf = data.players.find(p => p.id === this.player?.id);
                    if (updatedSelf) this.player = { ...updatedSelf };
                    // Update gameState if included
                    if (data.gameState) this.room.gameState = data.gameState;
                }
            },
            [SOCKET_EVENTS.PLAYER_LEFT]: (data) => {
                 console.log("Socket: PLAYER_LEFT", data);
                 this.messages.push({ sender: 'System', message: `${data.playerName} left the room.`, type: 'system' });
                 // ROOM_UPDATE broadcast from server handles the actual player list update
            },
            [SOCKET_EVENTS.NEW_HOST]: (data) => {
                 console.log("Socket: NEW_HOST", data);
                 if (this.room) {
                     this.room.hostId = data.hostId;
                     this.messages.push({ sender: 'System', message: `${data.hostName} is now the host.`, type: 'system' });
                 }
            },
            [SOCKET_EVENTS.GAME_STARTED]: (data) => {
                console.log("Socket: GAME_STARTED received", data);
                if (this.room) {
                     console.log("Updating view to GAME_AREA...");
                     this.room.settings.scoreGoal = data.scoreGoal;
                     this.currentView = VIEWS.GAME_AREA;
                     this.messages = []; // Clear messages for new game
                     this.roomTeamScore = 0; // Reset team score display

                     // Wait for DOM update before initializing canvas
                     this.$nextTick(() => {
                        console.log("DOM updated, attempting to init canvas...");
                        const canvasEl = document.getElementById('drawing-canvas');
                        if (canvasEl) {
                            canvas.initCanvas(canvasEl, this.room.id);
                            this.applyDarkMode(); // Ensure canvas color is set correctly
                            canvas.setBrushSize(this.brushSize);
                            canvas.clearCanvas();
                            canvas.setDrawingEnabled(false); // Initially disabled
                        } else {
                            console.error("Drawing canvas element not found after nextTick!");
                        }
                     });
                 }
            },
            [SOCKET_EVENTS.NEW_TURN]: (data) => {
                console.log("Socket: NEW_TURN", data);
                 if (this.room && this.player) {
                     this.isDrawing = this.player.id === data.drawerId;
                     this.currentWord = null; // Reset word for non-drawers
                     this.timeLeft = data.timeLeft;
                     // Update gameState if provided
                     if (data.gameState) this.room.gameState = data.gameState;

                     canvas.setDrawingEnabled(this.isDrawing);
                     canvas.clearCanvas(); // Server also sends CLEAR_CANVAS_UPDATE, but clear locally too
                     this.guessInput = ''; // Clear guess input for everyone
                     this.messages.push({ sender: 'System', message: `${data.drawerName} is drawing!`, type: 'system' });

                     // Re-enable guess input if it was disabled
                     // const guessInputEl = document.getElementById('guess-input');
                     // if (guessInputEl) guessInputEl.disabled = false;
                 }
            },
            [SOCKET_EVENTS.YOUR_TURN_TO_DRAW]: (data) => {
                 console.log("Socket: YOUR_TURN_TO_DRAW", data);
                 this.currentWord = data.word; // Only drawer receives this
                 // Word is displayed conditionally in HTML based on this.currentWord and this.isDrawing
            },
            [SOCKET_EVENTS.DRAWING_UPDATE]: canvas.handleIncomingDrawData, // Forward directly
            [SOCKET_EVENTS.CLEAR_CANVAS_UPDATE]: canvas.clearCanvas, // Forward directly
            [SOCKET_EVENTS.CHAT_MESSAGE]: (data) => {
                 console.log("Socket: CHAT_MESSAGE", data);
                 this.messages.push({ sender: data.sender, message: data.message, type: data.type || 'chat' });
            },
            [SOCKET_EVENTS.GUESS_RESULT]: (data) => {
                 console.log("Socket: GUESS_RESULT", data);
                 if (data.isCorrect) {
                     this.messages.push({ sender: data.playerName, message: `guessed the word! (+${data.pointsAwarded} points)`, type: 'correct-guess' });
                     // Optionally disable guess input for the correct guesser
                     // if (this.player?.id === data.playerId) {
                     //    const guessInputEl = document.getElementById('guess-input');
                     //    if (guessInputEl) guessInputEl.disabled = true;
                     // }
                 }
                 // Incorrect guesses are shown via CHAT_MESSAGE
            },
            [SOCKET_EVENTS.SCORE_UPDATE]: (data) => {
                 console.log("Socket: SCORE_UPDATE", data);
                 if (this.room) {
                     // Update the team score directly
                     this.roomTeamScore = data.teamScore;
                     // Player scores are updated via ROOM_UPDATE which includes the full player list
                 }
            },
            [SOCKET_EVENTS.TIMER_UPDATE]: (data) => {
                 this.timeLeft = data.timeLeft;
            },
            [SOCKET_EVENTS.GAME_OVER]: (data) => {
                 console.log("Socket: GAME_OVER", data);
                 // Update final team score
                 this.roomTeamScore = data.finalTeamScore;
                 this.isDrawing = false;
                 this.currentWord = null;
                 canvas.setDrawingEnabled(false);
                 this.showNotification(`Game Over! ${data.reason}`, 'info', 5000);
                 // Transition back to lobby after a delay
                 setTimeout(() => {
                     if (this.room && this.player) {
                         // Reset game-specific state before showing lobby
                         this.timeLeft = 0;
                         // Optionally reset individual player scores in the list if desired
                         // if (this.room.players) {
                         //     this.room.players.forEach(p => p.score = 0);
                         // }
                         this.currentView = VIEWS.LOBBY;
                     } else {
                         this.currentView = VIEWS.INITIAL_SETUP; // Fallback
                     }
                 }, 5000);
            },
            [SOCKET_EVENTS.ERROR]: (data) => {
                 console.error("Socket: ERROR received", data);
                 this.showError(`Server Error: ${data.message || 'Unknown error'}`);
                 // Consider if disconnect/reset is needed based on error type
            },
            [SOCKET_EVENTS.DISCONNECT]: (reason) => {
                 console.log(`Socket: DISCONNECT`, reason);
                 // Only show error if it wasn't a manual leaveRoom() disconnect
                 if (this.currentView !== VIEWS.INITIAL_SETUP) {
                    this.showNotification('Disconnected from server.', 'error');
                 }
                 this.resetState();
                 this.currentView = VIEWS.INITIAL_SETUP;
                 canvas.clearCanvas();
                 canvas.setDrawingEnabled(false);
                 this.listenersRegistered = false; // Allow re-registration on next connect
            }
        };

        // Remove potential old listeners first (defensive)
        Object.keys(eventHandlers).forEach(event => socket.off(event));
        // Add new listeners
        Object.entries(eventHandlers).forEach(([event, handler]) => {
            socket.on(event, handler);
        });

        this.listenersRegistered = true; // Mark as registered
    },
    listenersRegistered: false // Flag to prevent duplicate listeners
};

// --- Initialize App ---
console.log("Initializing petite-vue app...");
const app = createApp(appState);
app.mount('#app-container');
console.log("petite-vue mounted to #app-container.");

// Initialize dark mode based on preference/storage
appState.initDarkMode();

// Populate hint modal content (static content)
// populateHintModal('hint-content'); // Removed: now called when modal is shown

// Removed global drag initialization - moved into toggleHintModal's $nextTick