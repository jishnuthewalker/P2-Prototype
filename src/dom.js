// src/dom.js

/**
 * Retrieves references to all necessary DOM elements.
 * Call this function after the DOM is fully loaded.
 * @returns {Object.<string, HTMLElement>} An object mapping element names to their corresponding HTMLElement references.
 */
export function getDomElements() {
    // Use querySelector for potentially slightly more resilience, though getElementById is standard.
    // If an element is not found, the corresponding property will be null.
    return {
        // Initial Setup
        initialSetupView: document.getElementById('initial-setup'),
        playerNameInput: document.getElementById('player-name-input'),
        createRoomBtn: document.getElementById('create-room-btn'),
        roomIdInput: document.getElementById('room-id-input'),
        joinRoomBtn: document.getElementById('join-room-btn'),
        setupError: document.getElementById('setup-error'),

        // Game Lobby
        gameLobbyView: document.getElementById('game-lobby'),
        lobbyRoomId: document.getElementById('lobby-room-id'),
        lobbyPlayerCount: document.getElementById('lobby-player-count'),
        lobbyPlayerList: document.getElementById('lobby-player-list'),
        lobbyScoreGoalInput: document.getElementById('lobby-score-goal'),
        lobbyStartGameBtn: document.getElementById('lobby-start-game-btn'),
        lobbyHostName: document.getElementById('lobby-host-name'),
        leaveRoomBtn: document.getElementById('leave-room-btn'), // Shared

        // Game Area
        gameAreaView: document.getElementById('game-area'),
        topBar: document.getElementById('top-bar'),
        topBarDrawer: document.getElementById('top-bar-drawer'),
        topBarTimer: document.getElementById('top-bar-timer'),
        toggleScoreBtn: document.getElementById('toggle-score-btn'),

        // Drawing Section
        drawingSection: document.getElementById('drawing-content'),
        toggleDrawingBtn: document.getElementById('toggle-drawing-btn'),
        drawingInfo: document.getElementById('drawing-info'),
        turnIndicator: document.getElementById('turn-indicator'),
        letterToDrawContainer: document.getElementById('letter-to-draw-container'),
        letterToDrawScript: document.getElementById('letter-to-draw-script'),
        letterToDrawLatin: document.getElementById('letter-to-draw-latin'),
        showLetterBtn: document.getElementById('show-letter-btn'),
        canvasContainer: document.getElementById('canvas-container'),
        drawingCanvas: document.getElementById('drawing-canvas'),
        colorPicker: document.getElementById('color-picker'),
        brushSizeSlider: document.getElementById('brush-size'),
        clearCanvasBtn: document.getElementById('clear-canvas-btn'),

        // Guessing Section
        guessInputContainer: document.getElementById('guess-input-container'),
        guessInput: document.getElementById('guess-input'),
        sendGuessBtn: document.getElementById('send-guess-btn'), // The problematic one

        // Chat Section
        chatSection: document.getElementById('chat-content'),
        toggleChatBtn: document.getElementById('toggle-chat-btn'),
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),

        // Scoreboard Section
        fullScoreboardSection: document.getElementById('full-scoreboard-section'),
        playerScoresContainer: document.getElementById('player-scores'),
        currentTeamScore: document.getElementById('current-team-score'),
        teamGoalDisplay: document.getElementById('team-goal-display'),

        // General
        endGameBtn: document.getElementById('end-game-btn'), // Note: ID might be shared if used in lobby too
        messageBox: document.getElementById('message-box'),
    };
}