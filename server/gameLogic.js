const KANNADA_LETTERS = [
    // Simple vowels (Swara)
    { script: "ಅ", latin: "a" }, { script: "ಆ", latin: "aa" }, { script: "ಇ", latin: "i" },
    { script: "ಈ", latin: "ee" }, { script: "ಉ", latin: "u" }, { script: "ಊ", latin: "oo" },
    { script: "ಋ", latin: "ru" }, { script: "ಎ", latin: "e" }, { script: "ಏ", latin: "ē" },
    { script: "ಐ", latin: "ai" }, { script: "ಒ", latin: "o" }, { script: "ಓ", latin: "ō" },
    { script: "ಔ", latin: "au" },
    // Consonants (Vyanjana) - Example subset
    { script: "ಕ", latin: "ka" }, { script: "ಖ", latin: "kha" }, { script: "ಗ", latin: "ga" },
    { script: "ಘ", latin: "gha" }, { script: "ಚ", latin: "cha" }, { script: "ಛ", latin: "chha" },
    { script: "ಜ", latin: "ja" }, { script: "ಝ", latin: "jha" }, { script: "ಟ", latin: "ṭa" },
    { script: "ಠ", latin: "ṭha" }, { script: "ಡ", latin: "ḍa" }, { script: "ಢ", latin: "ḍha" },
    { script: "ತ", latin: "ta" }, { script: "ಥ", latin: "tha" }, { script: "ದ", latin: "da" },
    { script: "ಧ", latin: "dha" }, { script: "ನ", latin: "na" }, { script: "ಪ", latin: "pa" },
    { script: "ಫ", latin: "pha" }, { script: "ಬ", latin: "ba" }, { script: "ಭ", latin: "bha" },
    { script: "ಮ", latin: "ma" }, { script: "ಯ", latin: "ya" }, { script: "ರ", latin: "ra" },
    { script: "ಲ", latin: "la" }, { script: "ವ", latin: "va" }, { script: "ಶ", latin: "sha" },
    { script: "ಷ", latin: "ṣha" }, { script: "ಸ", latin: "sa" }, { script: "ಹ", latin: "ha" },
    { script: "ಳ", latin: "ḷa" },
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

    // Reset scores and initialize game state
    room.players.forEach(p => p.score = 0); // Reset scores at game start
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
    const isCorrect = (playerGuess === correctWord.script || playerGuess === correctWord.latin.toLowerCase());

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

        // Update player and team scores
        player.score = (player.score || 0) + pointsAwarded; // Ensure score is initialized
        room.gameState.teamScore = (room.gameState.teamScore || 0) + pointsAwarded;

        // Notify players of the correct guess
        io.to(room.id).emit(EVENTS.GUESS_RESULT, {
            playerId: player.id,
            playerName: player.name,
            isCorrect: true,
            word: correctWord, // Reveal the word
            pointsAwarded: pointsAwarded
        });

        // Notify players of the score update
        io.to(room.id).emit(EVENTS.SCORE_UPDATE, {
            players: room.players, // Send updated scores for all players
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
        finalScores: room.players, // Send final scores
        finalTeamScore: room.gameState.teamScore
    });

    // Note: Scores are not automatically reset here. The game might transition
    // back to the lobby where scores are visible until a new game starts.
}


module.exports = {
    startGame,
    startNewTurn,
    handleGuess,
    endGame
};