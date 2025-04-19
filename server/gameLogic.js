const KANNADA_LETTERS = [
    // Simple vowels (Swara) - Added qwerty mapping
    { script: "ಅ", latin: "a", qwerty: "a" }, { script: "ಆ", latin: "ā", qwerty: "aa" }, { script: "ಇ", latin: "i", qwerty: "i" },
    { script: "ಈ", latin: "ī", qwerty: "ee" }, { script: "ಉ", latin: "u", qwerty: "u" }, { script: "ಊ", latin: "ū", qwerty: "oo" },
    { script: "ಋ", latin: "ṛ", qwerty: "ru" }, { script: "ಎ", latin: "e", qwerty: "e" }, { script: "ಏ", latin: "ē", qwerty: "ee" }, // Use 'ee' for long E
    { script: "ಐ", latin: "ai", qwerty: "ai" }, { script: "ಒ", latin: "o", qwerty: "o" }, { script: "ಓ", latin: "ō", qwerty: "oo" }, // Use 'oo' for long O
    { script: "ಔ", latin: "au", qwerty: "au" },
    // Consonants (Vyanjana) - Added qwerty mapping
    { script: "ಕ", latin: "ka", qwerty: "ka" }, { script: "ಖ", latin: "kha", qwerty: "kha" }, { script: "ಗ", latin: "ga", qwerty: "ga" },
    { script: "ಘ", latin: "gha", qwerty: "gha" }, { script: "ಚ", latin: "cha", qwerty: "cha" }, { script: "ಛ", latin: "chha", qwerty: "chha" },
    { script: "ಜ", latin: "ja", qwerty: "ja" }, { script: "ಝ", latin: "jha", qwerty: "jha" }, { script: "ಟ", latin: "ṭa", qwerty: "Ta" }, // Retroflex T
    { script: "ಠ", latin: "ṭha", qwerty: "Tha" }, { script: "ಡ", latin: "ḍa", qwerty: "Da" }, { script: "ಢ", latin: "ḍha", qwerty: "Dha" },
    { script: "ತ", latin: "ta", qwerty: "ta" }, { script: "ಥ", latin: "tha", qwerty: "tha" }, { script: "ದ", latin: "da", qwerty: "da" },
    { script: "ಧ", latin: "dha", qwerty: "dha" }, { script: "ನ", latin: "na", qwerty: "na" }, { script: "ಪ", latin: "pa", qwerty: "pa" },
    { script: "ಫ", latin: "pha", qwerty: "pha" }, { script: "ಬ", latin: "ba", qwerty: "ba" }, { script: "ಭ", latin: "bha", qwerty: "bha" },
    { script: "ಮ", latin: "ma", qwerty: "ma" }, { script: "ಯ", latin: "ya", qwerty: "ya" }, { script: "ರ", latin: "ra", qwerty: "ra" },
    { script: "ಲ", latin: "la", qwerty: "la" }, { script: "ವ", latin: "va", qwerty: "va" }, { script: "ಶ", latin: "sha", qwerty: "sha" },
    { script: "ಷ", latin: "ṣha", qwerty: "Sha" }, { script: "ಸ", latin: "sa", qwerty: "sa" }, { script: "ಹ", latin: "ha", qwerty: "ha" },
    { script: "ಳ", latin: "ḷa", qwerty: "La" }, // Retroflex L
];

const TURN_DURATION_SECONDS = 90;
const NEXT_TURN_DELAY_MS = 2000; // Delay after correct guess before next turn

// Use shared constants
const EVENTS = require('./constants');

// --- Helper Functions ---

/**
 * Clears the turn timer interval for a room if it exists.
 * @param {object} room - The room object.
 */
function clearTurnTimer(room) {
    if (room?.gameState?.turnTimerId) {
        clearInterval(room.gameState.turnTimerId);
        room.gameState.turnTimerId = null;
    }
}

/**
 * Selects the next player index in a round-robin fashion.
 * @param {number} currentIndex - The current player index.
 * @param {number} playerCount - The total number of players.
 * @returns {number} The index of the next player.
 */
function getNextPlayerIndex(currentIndex, playerCount) {
    if (playerCount <= 0) return -1;
    return (currentIndex + 1) % playerCount;
}

/**
 * Selects a random word (Kannada letter) for the turn.
 * @returns {{ script: string, latin: string }} The selected word object.
 */
function selectRandomWord() {
    const randomIndex = Math.floor(Math.random() * KANNADA_LETTERS.length);
    return KANNADA_LETTERS[randomIndex];
}

/**
 * Calculates points awarded for a correct guess.
 * @param {number} timeLeft - Time remaining in the turn.
 * @param {number} turnDuration - Total duration of the turn.
 * @returns {number} Points awarded.
 */
function calculatePoints(timeLeft, turnDuration) {
    // Example scoring: More points for faster guesses
    const timeFactor = Math.max(0, timeLeft / turnDuration); // Factor between 0 and 1
    const basePoints = 10; // Base points for a correct guess
    const bonusPoints = Math.round(basePoints * timeFactor); // Bonus based on time
    return basePoints + bonusPoints;
}

// --- Core Game Logic Functions ---

/**
 * Starts the game in a specific room.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object.
 * @param {number} scoreGoal - The score needed to win.
 */
function startGame(io, room, scoreGoal) {
    if (!room || !io) {
        console.error("[startGame] Invalid arguments: io or room missing.");
        return;
    }
    console.log(`[GameLogic] Starting game in room ${room.id} with goal ${scoreGoal}`);

    // Initialize game state (individual scores are no longer reset here)
    // room.players.forEach(p => p.score = 0); // Reset scores at game start - REMOVED
    room.gameState = {
        ...room.gameState, // Keep existing parts like settings if needed
        isGameActive: true,
        scoreGoal: scoreGoal || 50,
        teamScore: 0,
        currentPlayerIndex: -1, // Will be incremented in startNewTurn
        currentDrawerId: null,
        currentWord: null,
        timeLeft: 0,
        turnStartTime: null,
        turnTimerId: null,
    };

    // Notify all players in the room that the game has started
    io.to(room.id).emit(EVENTS.GAME_STARTED, {
        scoreGoal: room.gameState.scoreGoal,
        players: room.players // Send initial player list with reset scores
    });

    // Start the first turn
    startNewTurn(io, room);
}

/**
 * Starts a new turn, selecting the next drawer and word.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object.
 */
function startNewTurn(io, room) {
    if (!room || !io || !room.gameState.isGameActive || room.players.length < 1) {
        console.log(`[GameLogic] Cannot start new turn in room ${room?.id}. Conditions not met.`);
        // Consider ending game if players < 2? (Handled in disconnect logic)
        return;
    }

    clearTurnTimer(room); // Ensure previous timer is cleared

    // Select next player
    room.gameState.currentPlayerIndex = getNextPlayerIndex(room.gameState.currentPlayerIndex, room.players.length);
    const currentDrawer = room.players[room.gameState.currentPlayerIndex];
    if (!currentDrawer) {
        console.error(`[GameLogic] Failed to select drawer for room ${room.id} at index ${room.gameState.currentPlayerIndex}`);
        endGame(io, room, "Error selecting next player."); // End game if player selection fails
        return;
    }
    room.gameState.currentDrawerId = currentDrawer.id;

    // Select a new word
    room.gameState.currentWord = selectRandomWord();

    console.log(`[GameLogic] New turn for room ${room.id}. Drawer: ${currentDrawer.name}, Letter: ${room.gameState.currentWord.script}`);

    // Reset turn timer state
    room.gameState.timeLeft = TURN_DURATION_SECONDS;
    room.gameState.turnStartTime = Date.now();

    // Notify players about the new turn
    io.to(room.id).emit(EVENTS.NEW_TURN, {
        drawerId: currentDrawer.id,
        drawerName: currentDrawer.name,
        timeLeft: room.gameState.timeLeft,
    });

    // Send the word only to the drawer
    io.to(currentDrawer.id).emit(EVENTS.YOUR_TURN_TO_DRAW, {
        word: room.gameState.currentWord
    });

    // Clear canvas for everyone
    io.to(room.id).emit(EVENTS.CLEAR_CANVAS_UPDATE);

    // Start the turn timer interval
    room.gameState.turnTimerId = setInterval(() => {
        if (!room.gameState.isGameActive) { // Safety check if game ended during interval
            clearTurnTimer(room);
            return;
        }

        room.gameState.timeLeft--;
        io.to(room.id).emit(EVENTS.TIMER_UPDATE, { timeLeft: room.gameState.timeLeft });

        if (room.gameState.timeLeft <= 0) {
            // Time's up!
            clearTurnTimer(room);
            io.to(room.id).emit(EVENTS.CHAT_MESSAGE, { // Use correct event name
                sender: 'System',
                message: `Time's up! The letter was ${room.gameState.currentWord?.script || '?'} (${room.gameState.currentWord?.latin || '?'}).`,
                type: 'system'
            });
            startNewTurn(io, room); // Start next turn automatically
        }
    }, 1000);
}

/**
 * Handles a player's guess.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object.
 * @param {object} player - The player object who guessed.
 * @param {string} guessText - The text of the guess.
 */
function handleGuess(io, room, player, guessText) {
    // Validate conditions for guessing
    if (!room?.gameState?.isGameActive || !room.gameState.currentWord || player?.id === room.gameState.currentDrawerId) {
        return;
    }

    const correctWord = room.gameState.currentWord;
    const playerGuess = guessText.trim().toLowerCase();

    // Check against both script and latin forms
    const isCorrect = (playerGuess === correctWord.script.toLowerCase() || // Check script (Kannada)
                         playerGuess === correctWord.latin.toLowerCase() || // Check standard Latin
                         playerGuess === correctWord.qwerty.toLowerCase()); // Check simplified QWERTY Latin

    // Broadcast the guess attempt as a chat message
    io.to(room.id).emit(EVENTS.CHAT_MESSAGE, {
        sender: player.name,
        message: guessText, // Show original guess text
        type: 'chat'
    });

    if (isCorrect) {
        console.log(`[GameLogic] Correct guess by ${player.name} in room ${room.id}! Letter: ${correctWord.script}`);

        clearTurnTimer(room); // Stop timer on correct guess

        // Award points
        const pointsAwarded = calculatePoints(room.gameState.timeLeft, TURN_DURATION_SECONDS);

        // Update team score
        // player.score = (player.score || 0) + pointsAwarded; // Individual score removed
        room.gameState.teamScore = (room.gameState.teamScore || 0) + pointsAwarded;

        // Notify players of the correct guess
        io.to(room.id).emit(EVENTS.GUESS_RESULT, {
            playerId: player.id,
            playerName: player.name,
            isCorrect: true,
            word: correctWord, // Reveal the word
            pointsAwarded: pointsAwarded
        });

        // Notify players of the team score update
        io.to(room.id).emit(EVENTS.SCORE_UPDATE, {
            // players: room.players, // Individual scores no longer sent
            teamScore: room.gameState.teamScore
        });

        // Check for game over condition
        if (room.gameState.teamScore >= room.gameState.scoreGoal) {
            endGame(io, room, `${player.name} made the winning guess!`);
        } else {
            // Start the next turn after a short delay
            setTimeout(() => startNewTurn(io, room), NEXT_TURN_DELAY_MS);
        }
    }
    // Incorrect guesses are implicitly handled by just showing the chat message
}

/**
 * Ends the game in a specific room.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object.
 * @param {string} reason - The reason the game ended.
 */
function endGame(io, room, reason) {
    if (!room || !io) {
        console.error("[endGame] Invalid arguments: io or room missing.");
        return;
    }
    console.log(`[GameLogic] Game ending in room ${room.id}. Reason: ${reason}`);

    clearTurnTimer(room); // Ensure timer is stopped

    // Update game state
    room.gameState.isGameActive = false;
    room.gameState.currentDrawerId = null;
    room.gameState.currentWord = null;
    room.gameState.timeLeft = 0;
    // Keep scores and player index as they are for final display

    // Notify players that the game is over
    io.to(room.id).emit(EVENTS.GAME_OVER, {
        reason: reason,
        // finalScores: room.players, // Individual scores no longer sent
        finalTeamScore: room.gameState.teamScore
    });

    // Note: Scores are not automatically reset here. The game might transition
    // back to the lobby where scores are visible until a new game starts.
}


/**
 * Handles the game logic consequences of a player disconnecting.
 * Checks if the game needs to end or if a new turn should start.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object (potentially *after* the player is removed).
 * @param {string} disconnectedPlayerId - The ID of the player who disconnected.
 */
function handlePlayerDisconnect(io, room, disconnectedPlayerId) {
    // Check if game was active *before* disconnect potentially ended it
    if (!room || !room.gameState || !room.gameState.isGameActive) {
        return; // Game not active or room gone, nothing to do game-logic wise
    }

    console.log(`[GameLogic] Handling disconnect for player ${disconnectedPlayerId} in active game room ${room.id}`);

    // Check if enough players remain
    if (room.players.length < 2) {
        console.log(`[GameLogic] Only ${room.players.length} player(s) left, ending game.`);
        endGame(io, room, "Not enough players left.");
    } else if (room.gameState.currentDrawerId === disconnectedPlayerId) {
        // If the drawer disconnected, start a new turn immediately
        console.log(`[GameLogic] Drawer ${disconnectedPlayerId} left, starting new turn.`);
        // Ensure the timer is cleared before starting the new turn
        clearTurnTimer(room); // Explicitly clear timer here
        startNewTurn(io, room);
    }
    // If a non-drawer left and there are still enough players, the current turn continues.
}


module.exports = {
    startGame,
    startNewTurn,
    handlePlayerDisconnect, // Export the new function
    handleGuess,
    endGame
};