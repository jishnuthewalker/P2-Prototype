// Define event names used for communication
const EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    CREATE_ROOM: 'createRoom', // Note: Client uses 'create_room'. Need consistency. Let's use snake_case everywhere.
    JOIN_ROOM: 'joinRoom',     // Client uses 'join_room'.
    ROOM_UPDATE: 'roomUpdate', // Client uses 'room_update'.
    PLAYER_JOINED: 'playerJoined', // Keep for potential specific notifications
    PLAYER_LEFT: 'playerLeft',     // Keep for potential specific notifications
    NEW_HOST: 'newHost',
    UPDATE_PLAYER_LIST: 'updatePlayerList', // Potentially redundant with ROOM_UPDATE
    START_GAME: 'startGame',     // Client uses 'start_game'.
    DRAWING: 'drawing',          // Client uses 'draw_data'.
    DRAWING_UPDATE: 'drawingUpdate', // Broadcast drawing data
    CLEAR_CANVAS: 'clearCanvas', // Client uses 'clear_canvas'.
    CLEAR_CANVAS_UPDATE: 'clearCanvasUpdate', // Broadcast clear canvas
    GUESS: 'guess',              // Client uses 'send_guess'.
    CHAT_MESSAGE: 'chatMessage', // Client uses 'send_message'.
    CHAT_UPDATE: 'chatUpdate',   // Broadcast chat message. Client uses 'chat_message'.
    // Game specific events
    GAME_STARTED: 'gameStarted', // Client uses 'game_started'.
    NEW_TURN: 'newTurn',         // Client uses 'new_turn'.
    GUESS_RESULT: 'guessResult', // Client uses 'guess_result'.
    SCORE_UPDATE: 'scoreUpdate',
    TIMER_UPDATE: 'timerUpdate',
    GAME_OVER: 'gameOver',       // Client uses 'game_over'.
    ERROR: 'error'               // Client uses 'error'.
};

// Let's standardize on snake_case as used in client's constants.js
const STANDARDIZED_EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
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


module.exports = STANDARDIZED_EVENTS;