// --- Initial Setup ---
export const initialSetupView = document.getElementById('initial-setup');
export const playerNameInput = document.getElementById('player-name-input');
export const createRoomBtn = document.getElementById('create-room-btn');
export const roomIdInput = document.getElementById('room-id-input');
export const joinRoomBtn = document.getElementById('join-room-btn');
export const setupError = document.getElementById('setup-error');

// --- Game Lobby ---
export const gameLobbyView = document.getElementById('game-lobby');
export const lobbyRoomId = document.getElementById('lobby-room-id');
export const lobbyPlayerCount = document.getElementById('lobby-player-count');
export const lobbyPlayerList = document.getElementById('lobby-player-list');
export const lobbyScoreGoalInput = document.getElementById('lobby-score-goal');
export const lobbyStartGameBtn = document.getElementById('lobby-start-game-btn');
export const lobbyHostName = document.getElementById('lobby-host-name');
export const leaveRoomBtn = document.getElementById('leave-room-btn'); // Shared between lobby and game? Check HTML

// --- Game Area ---
export const gameAreaView = document.getElementById('game-area');
export const topBar = document.getElementById('top-bar');
export const topBarDrawer = document.getElementById('top-bar-drawer');
export const topBarTimer = document.getElementById('top-bar-timer');
export const toggleScoreBtn = document.getElementById('toggle-score-btn');

// Drawing Section
export const drawingSection = document.getElementById('drawing-content');
export const toggleDrawingBtn = document.getElementById('toggle-drawing-btn');
export const drawingInfo = document.getElementById('drawing-info');
export const turnIndicator = document.getElementById('turn-indicator');
export const letterToDrawContainer = document.getElementById('letter-to-draw-container');
export const letterToDrawScript = document.getElementById('letter-to-draw-script');
export const letterToDrawLatin = document.getElementById('letter-to-draw-latin');
export const showLetterBtn = document.getElementById('show-letter-btn');
export const canvasContainer = document.getElementById('canvas-container');
export const drawingCanvas = document.getElementById('drawing-canvas');
export const colorPicker = document.getElementById('color-picker');
export const brushSizeSlider = document.getElementById('brush-size'); // Renamed from brush-size for clarity
export const clearCanvasBtn = document.getElementById('clear-canvas-btn');

// Guessing Section
export const guessInputContainer = document.getElementById('guess-input-container');
export const guessInput = document.getElementById('guess-input');
export const sendGuessBtn = document.getElementById('send-guess-btn');

// Chat Section
export const chatSection = document.getElementById('chat-content');
export const toggleChatBtn = document.getElementById('toggle-chat-btn');
export const chatMessages = document.getElementById('chat-messages');

// Scoreboard Section
export const fullScoreboardSection = document.getElementById('full-scoreboard-section');
export const playerScoresContainer = document.getElementById('player-scores'); // Renamed from player-scores for clarity
export const currentTeamScore = document.getElementById('current-team-score');
export const teamGoalDisplay = document.getElementById('team-goal-display');

// --- General ---
export const endGameBtn = document.getElementById('end-game-btn');
export const messageBox = document.getElementById('message-box'); // For general messages/notifications