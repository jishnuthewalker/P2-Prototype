import * as dom from './dom.js';
import * as constants from './constants.js';

// --- View Management ---

const allViews = [
    dom.initialSetupView,
    dom.gameLobbyView,
    dom.gameAreaView,
];

/**
 * Hides all views and shows the specified view.
 * @param {string} viewId - The ID of the view to show (from constants.VIEWS).
 */
export function showView(viewId) {
    console.log(`Switching view to: ${viewId}`);
    allViews.forEach(view => {
        if (view) { // Check if element exists
            view.classList.add('hidden');
        } else {
            console.warn(`View element not found for ID: ${viewId} (during hide loop)`);
        }
    });

    const viewToShow = document.getElementById(viewId);
    if (viewToShow) {
        viewToShow.classList.remove('hidden');
    } else {
        console.error(`View element not found for ID: ${viewId}`);
    }
}

// --- Initial Setup UI ---

/**
 * Displays an error message on the initial setup screen.
 * @param {string} message - The error message to display.
 */
export function showSetupError(message) {
    if (dom.setupError) {
        dom.setupError.textContent = message;
        dom.setupError.classList.remove('hidden');
    }
}

/** Hides the setup error message. */
export function hideSetupError() {
    if (dom.setupError) {
        dom.setupError.classList.add('hidden');
    }
}

// --- Lobby UI ---

/**
 * Updates the lobby view with current room information.
 * @param {object} room - The room object from the server.
 * @param {string} currentPlayerId - The ID of the current player.
 * @param {boolean} isHost - Whether the current player is the host.
 */
export function updateLobbyView(room, currentPlayerId, isHost) {
    if (!dom.gameLobbyView || !room) return;

    dom.lobbyRoomId.textContent = room.id || '----';
    dom.lobbyPlayerCount.textContent = room.players?.length || 0;
    dom.lobbyScoreGoalInput.value = room.settings?.scoreGoal || constants.DEFAULT_SCORE_GOAL;

    // Update player list
    dom.lobbyPlayerList.innerHTML = ''; // Clear existing list
    let hostName = 'Unknown';
    room.players?.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        if (player.id === room.hostId) {
            li.textContent += ' (Host)';
            li.classList.add('font-bold', 'text-blue-600');
            hostName = player.name;
        }
        if (player.id === currentPlayerId) {
            li.textContent += ' (You)';
            li.classList.add('italic');
        }
        dom.lobbyPlayerList.appendChild(li);
    });

    dom.lobbyHostName.textContent = hostName;

    // Enable/disable start button and score goal input for host
    dom.lobbyStartGameBtn.disabled = !isHost || room.players?.length < 2; // Need at least 2 players
    dom.lobbyScoreGoalInput.disabled = !isHost;

    // Show host-specific info/controls
    if (isHost) {
        dom.lobbyStartGameBtn.textContent = 'Start Game';
        // Potentially show other host controls
    } else {
        dom.lobbyStartGameBtn.textContent = 'Waiting for Host...';
    }
}

/** Resets the lobby view to its default state. */
export function resetLobbyView() {
    if (!dom.gameLobbyView) return;
    dom.lobbyRoomId.textContent = '----';
    dom.lobbyPlayerCount.textContent = '0';
    dom.lobbyPlayerList.innerHTML = '';
    dom.lobbyScoreGoalInput.value = constants.DEFAULT_SCORE_GOAL;
    dom.lobbyStartGameBtn.disabled = true;
    dom.lobbyHostName.textContent = 'Host';
}

// --- Game Area UI ---

/**
 * Updates the main game view elements.
 * @param {object} room - The current room state.
 * @param {string} currentPlayerId - The ID of the current player.
 */
export function updateGameView(room, currentPlayerId) {
    if (!dom.gameAreaView || !room) return;

    updatePlayerScores(room.players, room.settings.scoreGoal);
    // Initial setup for other elements will be handled by game state updates (timer, turn, etc.)
    dom.teamGoalDisplay.textContent = room.settings.scoreGoal;
}

/**
 * Updates the player scores display.
 * @param {Array<object>} players - Array of player objects {id, name, score}.
 * @param {number} teamGoal - The target score for the team.
 */
export function updatePlayerScores(players, teamGoal) {
    if (!dom.playerScoresContainer || !players) return;

    dom.playerScoresContainer.innerHTML = ''; // Clear existing scores
    let totalTeamScore = 0;
    players.forEach(player => {
        const scoreElement = document.createElement('div');
        scoreElement.classList.add('player-score-item', 'text-sm'); // Add classes for styling
        scoreElement.innerHTML = `
            <span class="font-semibold">${player.name}:</span>
            <span class="text-green-700 font-bold">${player.score}</span>
        `;
        dom.playerScoresContainer.appendChild(scoreElement);
        totalTeamScore += player.score;
    });

    dom.currentTeamScore.textContent = totalTeamScore;
    // Maybe add visual indication if goal is reached?
}

/**
 * Adds a message to the chat display.
 * @param {string} message - The chat message content (can include HTML for formatting).
 * @param {string} [type='info'] - Type of message ('info', 'chat', 'correct', 'system').
 */
export function addChatMessage(message, type = 'info') {
    if (!dom.chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `chat-message-${type}`); // Base class + type class
    messageElement.innerHTML = message; // Use innerHTML to allow basic formatting

    dom.chatMessages.appendChild(messageElement);
    // Auto-scroll to the bottom
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

/**
 * Updates the turn indicator and letter display area.
 * @param {string} drawerName - Name of the current drawer.
 * @param {boolean} isDrawing - Is the current player the drawer?
 * @param {object|null} letter - The letter object { script, latin } or null if not drawing/showing.
 */
export function updateTurnDisplay(drawerName, isDrawing, letter = null) {
    if (!dom.gameAreaView) return;

    dom.topBarDrawer.textContent = drawerName || 'Unknown';
    dom.turnIndicator.textContent = isDrawing ? "It's your turn to draw!" : `Waiting for ${drawerName} to draw...`;

    if (isDrawing && letter) {
        dom.letterToDrawContainer.classList.remove('hidden');
        dom.letterToDrawScript.textContent = letter.script;
        dom.letterToDrawLatin.textContent = `(${letter.latin})`;
        dom.showLetterBtn.classList.add('hidden'); // Hide button once shown
    } else if (isDrawing) {
        // It's your turn, but the letter hasn't been revealed yet
        dom.letterToDrawContainer.classList.add('hidden');
        dom.showLetterBtn.classList.remove('hidden');
        dom.turnIndicator.textContent = "Your turn! Click 'Show Letter' to begin.";
    } else {
        // Not your turn
        dom.letterToDrawContainer.classList.add('hidden');
        dom.showLetterBtn.classList.add('hidden');
    }

    // Disable/enable drawing tools based on turn
    // TODO: Implement in canvas.js or here?
    // dom.drawingCanvas.style.pointerEvents = isDrawing ? 'auto' : 'none';
    // dom.colorPicker.disabled = !isDrawing;
    // dom.brushSizeSlider.disabled = !isDrawing;
    // dom.clearCanvasBtn.disabled = !isDrawing;
    // dom.guessInput.disabled = isDrawing;
    // dom.sendGuessBtn.disabled = isDrawing;
}

/**
 * Updates the timer display.
 * @param {number} timeLeft - Seconds remaining.
 */
export function updateTimerDisplay(timeLeft) {
    if (dom.topBarTimer) {
        dom.topBarTimer.textContent = timeLeft;
    }
}

// --- General UI ---

/**
 * Shows a temporary message/notification.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - 'info', 'success', 'error'.
 * @param {number} [duration=3000] - How long to show the message (ms).
 */
export function showNotification(message, type = 'info', duration = 3000) {
    if (!dom.messageBox) return;

    dom.messageBox.textContent = message;
    dom.messageBox.className = `message-box message-${type} show`; // Reset classes and show

    setTimeout(() => {
        dom.messageBox.classList.remove('show');
    }, duration);
}