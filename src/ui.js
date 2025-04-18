// Removed top-level dom import
import * as constants from './constants.js';
import * as state from './state.js'; // Import the state module

// --- View Management ---

/**
 * Hides all views and shows the specified view.
 * @param {string} viewId - The ID of the view to show (from constants.VIEWS).
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function showView(viewId, domElements) {
    console.log(`Switching view to: ${viewId}`);
    if (!domElements) {
        console.error("showView called without domElements!");
        return;
    }

    // Get view elements directly from the passed object
    const viewsToHide = [
        domElements.initialSetupView,
        domElements.gameLobbyView,
        domElements.gameAreaView,
    ];

    viewsToHide.forEach(view => {
        if (view) { // Check if element exists in the passed object
            view.classList.add('hidden');
        }
        // No need for warning here, main.js checks for essential views
    });

    // Find the view to show within the passed object based on ID
    let viewToShow = null;
    switch (viewId) {
        case constants.VIEWS.INITIAL_SETUP:
            viewToShow = domElements.initialSetupView;
            break;
        case constants.VIEWS.LOBBY:
            viewToShow = domElements.gameLobbyView;
            break;
        case constants.VIEWS.GAME_AREA:
            viewToShow = domElements.gameAreaView;
            break;
    }

    if (viewToShow) {
        viewToShow.classList.remove('hidden');
    } else {
        console.error(`View element not found in domElements for ID: ${viewId}`);
    }
}

// --- Initial Setup UI ---

/**
 * Displays an error message on the initial setup screen.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 * @param {string} message - The error message to display.
 */
export function showSetupError(domElements, message) {
    if (domElements?.setupError) {
        domElements.setupError.textContent = message;
        domElements.setupError.classList.remove('hidden');
    } else {
        console.warn("Attempted to show setup error, but setupError element missing in domElements.");
    }
}

/**
 * Hides the setup error message.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function hideSetupError(domElements) {
    if (domElements?.setupError) {
        domElements.setupError.classList.add('hidden');
    }
}

// --- Lobby UI ---

/**
 * Updates the lobby view using data from the state module.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function updateLobbyView(domElements) {
    const room = state.getRoom();
    const currentPlayerId = state.getPlayer()?.id;
    const isHost = state.isCurrentUserHost();

    // Check required elements from the passed object
    if (!domElements?.gameLobbyView || !domElements.lobbyRoomId || !domElements.lobbyPlayerCount ||
        !domElements.lobbyScoreGoalInput || !domElements.lobbyPlayerList || !domElements.lobbyHostName ||
        !domElements.lobbyStartGameBtn)
    {
        console.warn("updateLobbyView called but required lobby elements missing in domElements.");
        return;
    }
     if (!room) {
        console.warn("updateLobbyView called but no room data in state.");
        return;
    }


    domElements.lobbyRoomId.textContent = room.id || '----';
    domElements.lobbyPlayerCount.textContent = room.players?.length || 0;
    domElements.lobbyScoreGoalInput.value = room.settings?.scoreGoal || constants.DEFAULT_SCORE_GOAL;

    // Update player list
    domElements.lobbyPlayerList.innerHTML = ''; // Clear existing list
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
        domElements.lobbyPlayerList.appendChild(li);
    });

    domElements.lobbyHostName.textContent = hostName;

    // Enable/disable start button and score goal input for host
    domElements.lobbyStartGameBtn.disabled = !isHost || room.players?.length < 2; // Need at least 2 players
    domElements.lobbyScoreGoalInput.disabled = !isHost;

    // Show host-specific info/controls
    if (isHost) {
        domElements.lobbyStartGameBtn.textContent = 'Start Game';
        // Potentially show other host controls
    } else {
        domElements.lobbyStartGameBtn.textContent = 'Waiting for Host...';
    }
}

/**
 * Resets the lobby view to its default state.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function resetLobbyView(domElements) {
    if (!domElements?.gameLobbyView || !domElements.lobbyRoomId || !domElements.lobbyPlayerCount ||
        !domElements.lobbyScoreGoalInput || !domElements.lobbyPlayerList || !domElements.lobbyHostName ||
        !domElements.lobbyStartGameBtn)
    {
        console.warn("resetLobbyView called but required lobby elements missing in domElements.");
        return;
    }
    domElements.lobbyRoomId.textContent = '----';
    domElements.lobbyPlayerCount.textContent = '0';
    domElements.lobbyPlayerList.innerHTML = '';
    domElements.lobbyScoreGoalInput.value = constants.DEFAULT_SCORE_GOAL;
    domElements.lobbyStartGameBtn.disabled = true;
    domElements.lobbyHostName.textContent = 'Host';
}

// --- Game Area UI ---

/**
 * Updates the main game view elements using data from the state module.
 * Typically called once when entering the game view. Specific elements
 * like scores, timer, turn display are updated by their respective functions.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function updateGameView(domElements) {
    const room = state.getRoom();
    if (!domElements?.gameAreaView || !domElements.teamGoalDisplay) {
         console.warn("updateGameView called but required elements missing in domElements.");
         return;
    }
     if (!room) {
         console.warn("updateGameView called but no room data in state.");
         return;
    }

    // Update elements that depend on initial room settings
    domElements.teamGoalDisplay.textContent = room.settings?.scoreGoal || constants.DEFAULT_SCORE_GOAL;
    updatePlayerScores(domElements); // Update scores based on current state, passing domElements
    // Other elements (timer, turn indicator) are updated by specific handlers
}

/**
 * Updates the player scores display using data from the state module.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function updatePlayerScores(domElements) {
    const room = state.getRoom();
    const players = room?.players;
    const teamGoal = room?.settings?.scoreGoal; // Optional chaining

    if (!domElements?.playerScoresContainer || !domElements.currentTeamScore || !domElements.teamGoalDisplay) {
        console.warn("updatePlayerScores called but required score elements missing in domElements.");
        return;
    }
     if (!players) {
        // console.warn("updatePlayerScores called but no player data in state."); // Less critical warning
        domElements.playerScoresContainer.innerHTML = '<i>No player data</i>'; // Indicate missing data
        domElements.currentTeamScore.textContent = '0';
        domElements.teamGoalDisplay.textContent = teamGoal || constants.DEFAULT_SCORE_GOAL;
        return;
    }


    domElements.playerScoresContainer.innerHTML = ''; // Clear existing scores
    let totalTeamScore = 0;
    players.forEach(player => {
        const scoreElement = document.createElement('div');
        scoreElement.classList.add('player-score-item', 'text-sm'); // Add classes for styling
        scoreElement.innerHTML = `
            <span class="font-semibold">${player.name}:</span>
            <span class="text-green-700 font-bold">${player.score}</span>
        `;
        domElements.playerScoresContainer.appendChild(scoreElement);
        totalTeamScore += player.score;
    });

    domElements.currentTeamScore.textContent = totalTeamScore;
    domElements.teamGoalDisplay.textContent = teamGoal || constants.DEFAULT_SCORE_GOAL; // Ensure goal is displayed
    // Maybe add visual indication if goal is reached?
}

/**
 * Adds a message to the chat display.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 * @param {string} sender - Name of the sender ('System' for system messages).
 * @param {string} message - The chat message content.
 * @param {string} [type='chat'] - Type of message ('chat', 'system', 'correct-guess', 'error').
 */
export function addChatMessage(domElements, sender, message, type = 'chat') {
    if (!domElements?.chatMessages) {
        console.warn("addChatMessage called but chatMessages element missing in domElements.");
        return;
    }

    const messageElement = document.createElement('div');
    // Basic classes
    messageElement.classList.add('chat-message', 'mb-1', 'px-2', 'py-1', 'rounded', 'text-sm');

    // Type-specific classes for styling
    switch (type) {
        case 'system':
            messageElement.classList.add('text-gray-600', 'italic');
            messageElement.innerHTML = `<em>${message}</em>`; // Italicize system messages
            break;
        case 'correct-guess':
            messageElement.classList.add('text-green-700', 'font-semibold', 'bg-green-100');
            messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
            break;
        case 'error':
             messageElement.classList.add('text-red-700', 'font-semibold', 'bg-red-100');
             messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
             break;
        case 'chat':
        default:
             messageElement.classList.add('bg-gray-100');
             messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
            break;
    }


    domElements.chatMessages.appendChild(messageElement);
    // Auto-scroll to the bottom
    domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
}

/**
 * Updates the turn indicator and related UI elements based on state.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 * @param {string} drawerName - Name of the current drawer (passed from event data).
 */
export function updateTurnDisplay(domElements, drawerName) {
    if (!domElements?.gameAreaView || !domElements.topBarDrawer || !domElements.turnIndicator ||
        !domElements.letterToDrawContainer || !domElements.showLetterBtn || !domElements.guessInput ||
        !domElements.guessSendBtn)
    {
        console.warn("updateTurnDisplay called but required elements missing in domElements.");
        return;
    }

    const isDrawing = state.isCurrentUserDrawing();
    const word = state.getCurrentWord(); // Word is only set for the drawer via YOUR_TURN_TO_DRAW

    domElements.topBarDrawer.textContent = drawerName || 'Unknown';
    domElements.turnIndicator.textContent = isDrawing ? "It's your turn to draw!" : `Waiting for ${drawerName} to draw...`;

    // Show/hide word container and button
    domElements.letterToDrawContainer.classList.toggle('hidden', !isDrawing || !word);
    domElements.showLetterBtn.classList.toggle('hidden', !isDrawing || !!word); // Hide if drawing AND word is known

    if (isDrawing && word && domElements.letterToDrawScript && domElements.letterToDrawLatin) {
        domElements.letterToDrawScript.textContent = word.script;
        domElements.letterToDrawLatin.textContent = `(${word.latin})`;
    }
    // If drawing but word not yet revealed by handler (handleYourTurn)
    // The button is shown via the toggle above.

    // Disable/enable guess input based on drawing status
    domElements.guessInput.disabled = isDrawing;
    domElements.guessSendBtn.disabled = isDrawing;
    // Note: Canvas/drawing tool enabling/disabling should be handled by canvas.js based on state.setDrawingEnabled()
}

/**
 * Shows the word to the current drawer
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 * @param {object} word - The word object { script, latin }.
 */
export function showWordToDrawer(domElements, word) {
    if (!state.isCurrentUserDrawing() || !word) return; // Only for the drawer

    if (!domElements?.letterToDrawContainer || !domElements.letterToDrawScript || !domElements.letterToDrawLatin ||
        !domElements.showLetterBtn || !domElements.turnIndicator)
    {
        console.warn("showWordToDrawer called but required elements missing in domElements.");
        return;
    }

    domElements.letterToDrawContainer.classList.remove('hidden');
    domElements.letterToDrawScript.textContent = word.script;
    domElements.letterToDrawLatin.textContent = `(${word.latin})`;
    domElements.showLetterBtn.classList.add('hidden'); // Hide button now that word is shown
    domElements.turnIndicator.textContent = "Your turn! Draw the letter above."; // Update indicator
}


/**
 * Clears the guess input field.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function clearGuessInput(domElements) {
    if(domElements?.guessInput) domElements.guessInput.value = '';
}

/**
 * Disables the guess input field.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function disableGuessInput(domElements) {
    if(domElements?.guessInput) domElements.guessInput.disabled = true;
    if(domElements?.guessSendBtn) domElements.guessSendBtn.disabled = true;
}


/**
 * Updates the timer display.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 * @param {number} timeLeft - Seconds remaining.
 */
export function updateTimerDisplay(domElements, timeLeft) {
    if (domElements?.topBarTimer) {
        domElements.topBarTimer.textContent = timeLeft;
    }
}

/**
 * Resets the game view elements to their default state.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 */
export function resetGameView(domElements) {
    // Check for essential elements needed for reset
     if (!domElements?.gameAreaView || !domElements.topBarDrawer || !domElements.topBarTimer ||
        !domElements.turnIndicator || !domElements.letterToDrawContainer || !domElements.showLetterBtn ||
        !domElements.chatMessages || !domElements.guessInput || !domElements.guessSendBtn ||
        !domElements.playerScoresContainer || !domElements.currentTeamScore || !domElements.teamGoalDisplay)
    {
        console.warn("resetGameView called but required elements missing in domElements.");
        return;
    }

    domElements.topBarDrawer.textContent = 'Drawer';
    domElements.topBarTimer.textContent = '-';
    domElements.turnIndicator.textContent = 'Waiting for game...';
    domElements.letterToDrawContainer.classList.add('hidden');
    domElements.showLetterBtn.classList.add('hidden');
    domElements.chatMessages.innerHTML = '';
    domElements.guessInput.value = '';
    domElements.guessInput.disabled = true;
    domElements.guessSendBtn.disabled = true;
    domElements.playerScoresContainer.innerHTML = '';
    domElements.currentTeamScore.textContent = '0';
    domElements.teamGoalDisplay.textContent = '-';
    // Reset canvas state via canvas module if needed
}


// --- General UI ---

/**
 * Shows a temporary message/notification.
 * @param {Object.<string, HTMLElement>} domElements - The fetched DOM elements.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - 'info', 'success', 'error'.
 * @param {number} [duration=3000] - How long to show the message (ms).
 */
export function showNotification(domElements, message, type = 'info', duration = 3000) {
    if (!domElements?.messageBox) {
         console.warn("showNotification called but messageBox element missing in domElements.");
         return;
    }

    domElements.messageBox.textContent = message;
    domElements.messageBox.className = `message-box message-${type} show`; // Reset classes and show

    // Clear previous timeout if exists
    if (domElements.messageBox._notificationTimeout) {
        clearTimeout(domElements.messageBox._notificationTimeout);
    }

    domElements.messageBox._notificationTimeout = setTimeout(() => {
        domElements.messageBox.classList.remove('show');
        domElements.messageBox._notificationTimeout = null; // Clear timeout reference
    }, duration);
}