// Views
export const VIEWS = {
    INITIAL_SETUP: 'initial-setup',
    LOBBY: 'game-lobby',
    GAME_AREA: 'game-area',
};

// Add other constants as needed, e.g., event names, default settings
export const DEFAULT_SCORE_GOAL = 50;
export const MAX_PLAYERS = 8;

// Socket Event Names (Standardized with server/constants.js)
export const SOCKET_EVENTS = {
    // Client-Side Connection Events (Standard Socket.IO)
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error', // Standard Socket.IO event

    // Client Emits -> Server Listens
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    START_GAME: 'start_game',
    DRAW_DATA: 'draw_data',
    CLEAR_CANVAS: 'clear_canvas',
    SEND_GUESS: 'send_guess',
    SEND_MESSAGE: 'send_message',

    // Server Emits -> Client Listens
    ROOM_UPDATE: 'room_update',         // Full room state update
    PLAYER_JOINED: 'player_joined',     // Notification: another player joined
    PLAYER_LEFT: 'player_left',         // Notification: another player left
    NEW_HOST: 'new_host',               // Notification: host changed
    GAME_STARTED: 'game_started',       // Game is starting
    NEW_TURN: 'new_turn',               // New turn begins
    YOUR_TURN_TO_DRAW: 'your_turn_to_draw', // Specific instruction to the drawer
    DRAWING_UPDATE: 'drawing_update',   // Drawing data from current drawer
    CLEAR_CANVAS_UPDATE: 'clear_canvas_update', // Instruction to clear canvas
    CHAT_MESSAGE: 'chat_message',       // Incoming chat message from others/system
    GUESS_RESULT: 'guess_result',       // Result of a guess (correct/incorrect)
    SCORE_UPDATE: 'score_update',       // Scores have changed
    TIMER_UPDATE: 'timer_update',       // Turn timer update
    GAME_OVER: 'game_over',             // Game has ended
    ERROR: 'error',                     // Generic error from server
};