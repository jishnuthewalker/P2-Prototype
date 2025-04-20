// src/canvas.js

import * as socket from './socket.js';
import { SOCKET_EVENTS } from './constants.js';

// @ts-ignore
const SignaturePad = window.SignaturePad;

let canvas = null;
let signaturePad = null;
let currentRoomId = null;
let isDrawingEnabledLocally = false;
let debounceDrawTimeout = null; // Renamed for clarity
const DRAW_DEBOUNCE_DELAY = 150; // Slightly increased delay (optional)

/**
 * Debounced function to send drawing data.
 */
function debouncedSendDrawData() {
    if (debounceDrawTimeout) {
        clearTimeout(debounceDrawTimeout);
    }
    debounceDrawTimeout = setTimeout(() => {
        console.log(`[Canvas] Debounce triggered. Attempting to send draw data for room ${currentRoomId}...`);
        sendDrawData();
        debounceDrawTimeout = null;
    }, DRAW_DEBOUNCE_DELAY);
}

/**
 * Initializes the canvas and sets up SignaturePad.
 * @param {HTMLCanvasElement} canvasElement - The canvas element.
 * @param {string} roomId - The current room ID.
 */
export function initCanvas(canvasElement, roomId) {
    if (!canvasElement) {
        console.error("[Canvas] initCanvas called without a valid canvas element!");
        return;
    }
    if (!SignaturePad) {
        console.error("[Canvas] SignaturePad library not loaded!");
        return;
    }
    canvas = canvasElement;
    currentRoomId = roomId;

    resizeCanvas(); // Initial resize

    // Destroy previous instance if exists (safety for re-init)
    if (signaturePad) {
        signaturePad.off(); // Remove old listeners
    }
    try {
        signaturePad = new SignaturePad(canvas, {
            // Options:
            // minWidth: 0.5,
            // maxWidth: 2.5,
            penColor: '#000000', // Default color, will be updated by setCurrentColor
            // backgroundColor: 'rgba(255, 255, 255, 0)' // Transparent background
        });

        // --- Event Listeners ---
        // Listen for stroke end to send data
        signaturePad.addEventListener("endStroke", handleEndStroke); // Use named handler

        // Listen for window resize
        window.removeEventListener('resize', handleWindowResize); // Remove potential old listener, use named handler
        window.addEventListener('resize', handleWindowResize);

        console.log("[Canvas] SignaturePad initialized.");
        setDrawingEnabled(false); // Disabled by default

    } catch (error) {
        console.error("[Canvas] Failed to initialize SignaturePad:", error);
        // Optionally show an error to the user
    }
}

/** Handles the endStroke event from SignaturePad */
function handleEndStroke() {
    if (isDrawingEnabledLocally && currentRoomId) {
        debouncedSendDrawData(); // Use the debounced function
    }
}

/** Handles the window resize event */
function handleWindowResize() {
    // Debounce resize handling as well to avoid excessive redraws
    // (Implementation similar to draw debounce, omitted for brevity but recommended)
    resizeCanvas();
}


/** Adjusts canvas size and redraws content. */
function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;

    // Save current drawing data
    const data = signaturePad ? signaturePad.toData() : []; // Get data before resize

    // Resize based on parent element's client size
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.scale(ratio, ratio);
    }


    // Restore drawing data after resize
    if (signaturePad) {
        signaturePad.clear(); // Clear current (scaled) context
        signaturePad.fromData(data); // Redraw data on the correctly scaled canvas
    }
    console.log(`[Canvas] Resized to: ${canvas.width / ratio}x${canvas.height / ratio} (ratio: ${ratio})`);
}

/**
 * Enables or disables drawing interaction via SignaturePad's on/off methods.
 */
export function setDrawingEnabled(enabled) {
    isDrawingEnabledLocally = enabled; // Update local flag
    if (signaturePad) {
        if (enabled) {
            signaturePad.on(); // Enable drawing event listeners
            canvas.style.cursor = 'crosshair';
            canvas.style.pointerEvents = 'auto'; // Ensure canvas receives events
        } else {
            signaturePad.off(); // Disable drawing event listeners
            canvas.style.cursor = 'not-allowed';
            canvas.style.pointerEvents = 'none'; // Prevent events when not drawing
        }
        console.log(`[Canvas] SignaturePad drawing enabled: ${enabled}`);
    }
     // NOTE: Disabling/enabling controls (color picker, slider) is handled
    //       by petite-vue bindings in HTML based on appState.isDrawing
}

/** Sets the current pen color. */
export function setCurrentColor(color) {
    if (signaturePad) {
        signaturePad.penColor = color;
    }
}

/** Sets the current pen thickness (min/max width). */
export function setBrushSize(size) {
    // SignaturePad uses minWidth/maxWidth, not a single lineWidth
    // We can approximate by setting both, or use a fixed ratio
    const baseSize = parseInt(size, 10);
    const minW = Math.max(0.5, baseSize / 2); // Example: min is half of size
    const maxW = Math.max(1.0, baseSize * 1.5); // Example: max is 1.5 times size

    if (signaturePad) {
        signaturePad.minWidth = minW;
        signaturePad.maxWidth = maxW;
    }
}

/** Clears the canvas locally using SignaturePad's clear method. */
export function clearCanvas() {
    if (signaturePad) {
        try {
            signaturePad.clear();
            console.log("[Canvas] Cleared locally.");
            // Note: We might want to *also* send a clear event to the server here
            // if other users should see the clear immediately, even if the drawer
            // doesn't lift the pen (e.g., clicks a clear button).
            // socket.emit(SOCKET_EVENTS.CLEAR_CANVAS, currentRoomId);
        } catch (error) {
            console.error("[Canvas] Error clearing canvas:", error);
        }
    }
}


// --- Data Handling ---

/** Sends the entire drawing data (all points) to the server. */
function sendDrawData() {
    if (!signaturePad || !currentRoomId || !isDrawingEnabledLocally) {
        console.warn("[Canvas] sendDrawData called but conditions not met (pad, room, enabled).");
        return;
    }

    try {
        const data = signaturePad.toData(); // Gets array of point groups
        if (data && data.length > 0) {
            console.log(`[Canvas] Sending ${data.length} stroke groups.`);
            socket.emit(SOCKET_EVENTS.DRAW_DATA, currentRoomId, data);
        } else {
            console.log("[Canvas] No drawing data to send.");
        }
    } catch (error) {
        console.error("[Canvas] Error getting or sending drawing data:", error);
        // Potentially notify the user or attempt recovery
    }
}

/**
 * Handles incoming drawing data (full point data) from the server.
 * @param {Array} data - The array of point groups received.
 */
export function handleIncomingDrawData(data) {
    if (signaturePad && !isDrawingEnabledLocally) { // Only apply if not the current drawer
        try {
            console.log(`[Canvas] Received ${data?.length || 0} stroke groups from server.`);
            signaturePad.fromData(data || []); // Load the full drawing data
        } catch (error) {
            console.error("[Canvas] Error applying incoming drawing data:", error);
            // Maybe clear canvas or request full state?
        }
    } else if (!signaturePad) {
         console.warn("[Canvas] Received draw data but SignaturePad not initialized.");
    }
}

// Removed old drawing functions (startDrawing, draw, stopDrawing, drawLine, etc.)
// Removed getEventCoordinates helper