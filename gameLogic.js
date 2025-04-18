// Placeholder for game logic module required by server.js

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

const TURN_DURATION_SECONDS = 90; // Example turn duration

// Define event names (should match server.js) - Consider sharing constants
const EVENTS = {
    ROOM_UPDATE: 'roomUpdate',
    GAME_STARTED: 'gameStarted',
    NEW_TURN: 'newTurn',
    GUESS_RESULT: 'guessResult',
    SCORE_UPDATE: 'scoreUpdate',
    TIMER_UPDATE: 'timerUpdate',
    GAME_OVER: 'gameOver',
    CHAT_UPDATE: 'chatUpdate',
    CLEAR_CANVAS_UPDATE: 'clearCanvasUpdate',
};


/**
 * Starts the game in a specific room.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object.
 * @param {number} scoreGoal - The score needed to win.
 */
function startGame(io, room, scoreGoal) {
    console.log(`Starting game in room ${room.id} with goal ${scoreGoal}`);
    room.gameState.isGameActive = true;
    room.gameState.scoreGoal = scoreGoal || 50;
    room.gameState.teamScore = 0;
    room.gameState.currentPlayerIndex = -1; // Will be incremented in startNewTurn

    // Notify all players in the room that the game has started
    io.to(room.id).emit(EVENTS.GAME_STARTED, {
        scoreGoal: room.gameState.scoreGoal,
        players: room.players // Send initial player list with scores
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
    if (!room || !room.gameState.isGameActive || room.players.length < 1) {
        console.log(`Cannot start new turn in room ${room?.id}. Conditions not met.`);
        // Maybe end game if players < 2? Handled in disconnect logic for now.
        return;
    }

    // Clear previous turn timer if it exists
    if (room.gameState.turnTimerId) {
        clearInterval(room.gameState.turnTimerId);
        room.gameState.turnTimerId = null;
    }

    // Select next player (round-robin)
    room.gameState.currentPlayerIndex = (room.gameState.currentPlayerIndex + 1) % room.players.length;
    const currentDrawer = room.players[room.gameState.currentPlayerIndex];
    room.gameState.currentDrawerId = currentDrawer.id;

    // Select a new word (Kannada letter in this case)
    const randomIndex = Math.floor(Math.random() * KANNADA_LETTERS.length);
    room.gameState.currentWord = KANNADA_LETTERS[randomIndex]; // Store { script, latin }

    console.log(`New turn for room ${room.id}. Drawer: ${currentDrawer.name}, Letter: ${room.gameState.currentWord.script}`);

    // Reset turn timer
    room.gameState.timeLeft = TURN_DURATION_SECONDS;
    room.gameState.turnStartTime = Date.now();

    // Notify players about the new turn
    io.to(room.id).emit(EVENTS.NEW_TURN, {
        drawerId: currentDrawer.id,
        drawerName: currentDrawer.name,
        timeLeft: room.gameState.timeLeft,
    });

    // Send the word only to the drawer
    io.to(currentDrawer.id).emit('yourTurnToDraw', {
        word: room.gameState.currentWord // Send the { script, latin } object
    });

    // Clear canvas for everyone
    io.to(room.id).emit(EVENTS.CLEAR_CANVAS_UPDATE);

    // Start the turn timer
    room.gameState.turnTimerId = setInterval(() => {
        room.gameState.timeLeft--;
        io.to(room.id).emit(EVENTS.TIMER_UPDATE, { timeLeft: room.gameState.timeLeft });

        if (room.gameState.timeLeft <= 0) {
            // Time's up! End the current turn and start a new one.
            clearInterval(room.gameState.turnTimerId);
            room.gameState.turnTimerId = null;
            io.to(room.id).emit(EVENTS.CHAT_UPDATE, {
                sender: 'System',
                message: `Time's up! The letter was ${room.gameState.currentWord.script} (${room.gameState.currentWord.latin}).`,
                type: 'system'
            });
            startNewTurn(io, room);
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
    if (!room.gameState.isGameActive || !room.gameState.currentWord || player.id === room.gameState.currentDrawerId) {
        return; // Ignore guesses if game not active, no word, or drawer guesses
    }

    const correctWordScript = room.gameState.currentWord.script;
    const correctWordLatin = room.gameState.currentWord.latin.toLowerCase();
    const playerGuess = guessText.trim().toLowerCase();

    const isCorrect = (playerGuess === correctWordScript || playerGuess === correctWordLatin);

    // Broadcast the guess attempt as a chat message
    io.to(room.id).emit(EVENTS.CHAT_UPDATE, {
        sender: player.name,
        message: guessText, // Show original guess text
        type: 'chat'
    });

    if (isCorrect) {
        console.log(`Correct guess by ${player.name} in room ${room.id}! Letter: ${correctWordScript}`);

        // Award points (example: based on time remaining)
        const timeTaken = (Date.now() - room.gameState.turnStartTime) / 1000;
        const pointsAwarded = Math.max(1, Math.round(10 * (room.gameState.timeLeft / TURN_DURATION_SECONDS))); // Simple scoring

        // Update individual player score (optional, if tracking individual scores)
        player.score += pointsAwarded;

        // Update team score
        room.gameState.teamScore += pointsAwarded;

        // Clear the turn timer
        if (room.gameState.turnTimerId) {
            clearInterval(room.gameState.turnTimerId);
            room.gameState.turnTimerId = null;
        }

        // Notify players of the correct guess and score update
        io.to(room.id).emit(EVENTS.GUESS_RESULT, {
            playerId: player.id,
            playerName: player.name,
            isCorrect: true,
            word: room.gameState.currentWord, // Reveal the word
            pointsAwarded: pointsAwarded
        });
        io.to(room.id).emit(EVENTS.SCORE_UPDATE, {
            players: room.players, // Send updated scores for all players
            teamScore: room.gameState.teamScore
        });

        // Check for game over condition
        if (room.gameState.teamScore >= room.gameState.scoreGoal) {
            endGame(io, room, `${player.name} made the winning guess!`);
        } else {
            // Start the next turn after a short delay
            setTimeout(() => startNewTurn(io, room), 2000); // 2-second delay
        }
    }
    // No need for an 'else' here, incorrect guesses are just shown as chat messages.
}

/**
 * Ends the game in a specific room.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} room - The room object.
 * @param {string} reason - The reason the game ended.
 */
function endGame(io, room, reason) {
    console.log(`Game ending in room ${room.id}. Reason: ${reason}`);
    room.gameState.isGameActive = false;

    // Clear any active turn timer
    if (room.gameState.turnTimerId) {
        clearInterval(room.gameState.turnTimerId);
        room.gameState.turnTimerId = null;
    }

    // Reset game state parts (keep scores for final display)
    room.gameState.currentDrawerId = null;
    room.gameState.currentWord = null;
    room.gameState.timeLeft = 0;
    room.gameState.currentPlayerIndex = -1;

    // Notify players that the game is over
    io.to(room.id).emit(EVENTS.GAME_OVER, {
        reason: reason,
        finalScores: room.players, // Send final scores
        finalTeamScore: room.gameState.teamScore
    });

    // Optionally reset scores here or let players see them until they leave/restart
    // room.players.forEach(p => p.score = 0);
    // room.gameState.teamScore = 0;
}


module.exports = {
    startGame,
    startNewTurn,
    handleGuess,
    endGame
};