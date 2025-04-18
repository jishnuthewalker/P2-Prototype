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

// Kannada Alphabet for Hint Modal - Added qwerty mapping
export const KANNADA_ALPHABET = [
    // Vowels (Swaragalu)
    { script: 'ಅ', latin: 'a', qwerty: 'a' }, { script: 'ಆ', latin: 'ā', qwerty: 'aa' }, { script: 'ಇ', latin: 'i', qwerty: 'i' },
    { script: 'ಈ', latin: 'ī', qwerty: 'ee' }, { script: 'ಉ', latin: 'u', qwerty: 'u' }, { script: 'ಊ', latin: 'ū', qwerty: 'oo' },
    { script: 'ಋ', latin: 'ṛ', qwerty: 'ru' }, { script: 'ಎ', latin: 'e', qwerty: 'e' }, { script: 'ಏ', latin: 'ē', qwerty: 'ee' }, // Use 'ee' for long E
    { script: 'ಐ', latin: 'ai', qwerty: 'ai' }, { script: 'ಒ', latin: 'o', qwerty: 'o' }, { script: 'ಓ', latin: 'ō', qwerty: 'oo' }, // Use 'oo' for long O
    { script: 'ಔ', latin: 'au', qwerty: 'au' },
    // Yogavaahakagalu (Not typically guessed words, but included for completeness)
    { script: 'ಅಂ', latin: 'aṃ', qwerty: 'am' }, { script: 'ಅಃ', latin: 'aḥ', qwerty: 'ah' },
    // Consonants (Vyanjanagalu) - Structured
    // K-group
    { script: 'ಕ', latin: 'ka', qwerty: 'ka' }, { script: 'ಖ', latin: 'kha', qwerty: 'kha' }, { script: 'ಗ', latin: 'ga', qwerty: 'ga' },
    { script: 'ಘ', latin: 'gha', qwerty: 'gha' }, { script: 'ಙ', latin: 'ṅa', qwerty: 'nga' }, // Corrected Latin/qwerty
    // Ch-group
    { script: 'ಚ', latin: 'ca', qwerty: 'cha' }, { script: 'ಛ', latin: 'cha', qwerty: 'chha' }, { script: 'ಜ', latin: 'ja', qwerty: 'ja' },
    { script: 'ಝ', latin: 'jha', qwerty: 'jha' }, { script: 'ಞ', latin: 'ña', qwerty: 'nya' }, // Corrected Latin/qwerty
    // T-group (retroflex)
    { script: 'ಟ', latin: 'ṭa', qwerty: 'Ta' }, { script: 'ಠ', latin: 'ṭha', qwerty: 'Tha' }, { script: 'ಡ', latin: 'ḍa', qwerty: 'Da' },
    { script: 'ಢ', latin: 'ḍha', qwerty: 'Dha' }, { script: 'ಣ', latin: 'ṇa', qwerty: 'Na' }, // Corrected qwerty
    // T-group (dental)
    { script: 'ತ', latin: 'ta', qwerty: 'ta' }, { script: 'ಥ', latin: 'tha', qwerty: 'tha' }, { script: 'ದ', latin: 'da', qwerty: 'da' },
    { script: 'ಧ', latin: 'dha', qwerty: 'dha' }, { script: 'ನ', latin: 'na', qwerty: 'na' },
    // P-group
    { script: 'ಪ', latin: 'pa', qwerty: 'pa' }, { script: 'ಫ', latin: 'pha', qwerty: 'pha' }, { script: 'ಬ', latin: 'ba', qwerty: 'ba' },
    { script: 'ಭ', latin: 'bha', qwerty: 'bha' }, { script: 'ಮ', latin: 'ma', qwerty: 'ma' },
    // Semi-vowels / Approximants
    { script: 'ಯ', latin: 'ya', qwerty: 'ya' }, { script: 'ರ', latin: 'ra', qwerty: 'ra' }, { script: 'ಲ', latin: 'la', qwerty: 'la' },
    { script: 'ವ', latin: 'va', qwerty: 'va' },
    // Sibilants / Fricatives
    { script: 'ಶ', latin: 'śa', qwerty: 'sha' }, { script: 'ಷ', latin: 'ṣa', qwerty: 'Sha' }, { script: 'ಸ', latin: 'sa', qwerty: 'sa' },
    // Other
    { script: 'ಹ', latin: 'ha', qwerty: 'ha' }, { script: 'ಳ', latin: 'ḷa', qwerty: 'La' },
    // Note: Some sources might include ಕ್ಷ (ksha) and ಜ್ಞ (jna) here, but they are conjunct consonants.
];