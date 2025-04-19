// Standardized Socket Event Names (snake_case)
const EVENTS = {
    CONNECTION: 'connection', // Standard Socket.IO event
    DISCONNECT: 'disconnect', // Standard Socket.IO event
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    ROOM_UPDATE: 'room_update',
    PLAYER_JOINED: 'player_joined', // Specific notification if needed
    PLAYER_LEFT: 'player_left',     // Specific notification if needed
    NEW_HOST: 'new_host',
    START_GAME: 'start_game',
    DRAW_DATA: 'draw_data',         // Renamed from DRAWING
    DRAWING_UPDATE: 'drawing_update', // Broadcast drawing data
    CLEAR_CANVAS: 'clear_canvas',
    CLEAR_CANVAS_UPDATE: 'clear_canvas_update', // Broadcast clear canvas
    SEND_GUESS: 'send_guess',       // Renamed from GUESS
    SEND_MESSAGE: 'send_message',   // Renamed from CHAT_MESSAGE
    CHAT_MESSAGE: 'chat_message',   // Broadcast chat message (client listens for this)
    GAME_STARTED: 'game_started',
    NEW_TURN: 'new_turn',
    GUESS_RESULT: 'guess_result',
    SCORE_UPDATE: 'score_update',
    TIMER_UPDATE: 'timer_update',
    GAME_OVER: 'game_over',
    ERROR: 'error',
    // Client-only event listened for by server? No.
    // Server-only event listened for by client?
    YOUR_TURN_TO_DRAW: 'your_turn_to_draw' // From gameLogic
};


// Other Game Constants
const MAX_PLAYERS = 8;
const DEFAULT_SCORE_GOAL = 50;

module.exports = {
    ...EVENTS, // Spread the event names
    MAX_PLAYERS,
    DEFAULT_SCORE_GOAL
};