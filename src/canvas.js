// Removed dom and state imports
import * as socket from './socket.js'; // To send drawing data
import { SOCKET_EVENTS } from './constants.js'; // To use correct event names

let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentBrushSize = 3; // Default, will be set by main.js
let currentColor = '#000000'; // Default, will be set by main.js
let currentRoomId = null; // Store room ID when game starts

/**
 * Initializes the canvas and sets up event listeners.
 * @param {HTMLCanvasElement} canvasElement - The canvas element passed from main.js.
 * @param {string} roomId - The current room ID.
 */
export function initCanvas(canvasElement, roomId) {
    if (!canvasElement) {
        console.error("initCanvas called without a valid canvas element!");
        return;
    }
    canvas = canvasElement;
    currentRoomId = roomId; // Store room ID for sending data

    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context from canvas!");
        return;
    }

    // Set initial canvas dimensions based on container size
    resizeCanvas();

    // --- Remove previous listeners if any (safety measure) ---
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', stopDrawing);
    canvas.removeEventListener('touchcancel', stopDrawing);
    window.removeEventListener('resize', resizeCanvas); // Remove potential old listener

    // --- Add event listeners ---
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing); // Stop if mouse leaves canvas

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    // Listen for window resize to adjust canvas
    window.addEventListener('resize', resizeCanvas);

    // Initial brush properties are set via setCurrentColor/setBrushSize called from main.js
    if(ctx) {
        ctx.lineWidth = currentBrushSize;
        ctx.strokeStyle = currentColor;
    }

    console.log("Canvas initialized.");
    setDrawingEnabled(false); // Disabled by default
}

/** Adjusts canvas size to fit its container. */
function resizeCanvas() {
    if (!canvas || !canvas.parentElement || !ctx) return;
    // Save current drawing state if needed (optional)
    // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Resize based on parent element's client size
    canvas.width = canvas.parentElement.clientWidth;
    // Maintain a fixed aspect ratio (e.g., 16:9) or set a fixed height
    canvas.height = canvas.parentElement.clientWidth * (9 / 16); // Example: 16:9 aspect ratio
    // Or fixed height: canvas.height = 400;

    // Restore drawing state if saved (optional)
    // ctx.putImageData(imageData, 0, 0);

    // Re-apply drawing styles after resize (context might reset)
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = currentBrushSize;
    ctx.strokeStyle = currentColor;

    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
}

/**
 * Enables or disables canvas interaction.
 * Called by main.js based on game state.
 */
export function setDrawingEnabled(enabled) {
    if (!canvas) return;
    canvas.style.cursor = enabled ? 'crosshair' : 'not-allowed';
    // Prevent events entirely when not allowed to draw
    canvas.style.pointerEvents = enabled ? 'auto' : 'none';
    console.log(`Canvas drawing interaction enabled: ${enabled}`);
    // NOTE: Disabling/enabling controls (color picker, slider) is handled
    //       by petite-vue bindings in HTML based on appState.isDrawing
}

/** Sets the current brush color (called by main.js). */
export function setCurrentColor(color) {
    currentColor = color;
    if (ctx) {
        ctx.strokeStyle = currentColor;
    }
}

/** Sets the current brush size (called by main.js). */
export function setBrushSize(size) {
    currentBrushSize = parseInt(size, 10);
    if (ctx) {
        ctx.lineWidth = currentBrushSize;
    }
}


function startDrawing(e) {
    // pointerEvents style handles enabling/disabling
    isDrawing = true;
    [lastX, lastY] = getEventCoordinates(e);
}

function draw(e) {
    if (!isDrawing) return;
    const [currentX, currentY] = getEventCoordinates(e);

    // Draw locally first
    drawLine(lastX, lastY, currentX, currentY);
    // Send data for broadcast
    sendDrawData(lastX, lastY, currentX, currentY); // Pass roomId implicitly via module variable

    [lastX, lastY] = [currentX, currentY];
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
}

// --- Touch Event Handlers ---
function handleTouchStart(e) {
    e.preventDefault(); // Prevent scrolling/default touch actions
    if (e.touches.length > 0) {
        startDrawing(e.touches[0]);
    }
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling/default touch actions
     if (e.touches.length > 0) {
        draw(e.touches[0]);
    }
}


// --- Drawing Logic ---

/**
 * Draws a line segment on the canvas.
 * @param {number} x1 - Start X coordinate.
 * @param {number} y1 - Start Y coordinate.
 * @param {number} x2 - End X coordinate.
 * @param {number} y2 - End Y coordinate.
 * @param {string} [color=currentColor] - Color for this segment.
 * @param {number} [size=currentBrushSize] - Brush size for this segment.
 */
export function drawLine(x1, y1, x2, y2, color = currentColor, size = currentBrushSize) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
}

// --- Data Handling ---

/**
 * Sends a line segment drawing data to the server.
 * Uses the currentRoomId stored when initCanvas was called.
 * @param {number} x1 - Start X coordinate.
 * @param {number} y1 - Start Y coordinate.
 * @param {number} x2 - End X coordinate.
 * @param {number} y2 - End Y coordinate.
 */
function sendDrawData(x1, y1, x2, y2) {
    if (!currentRoomId || !canvas) return; // Don't send if not in a room or canvas not ready

    const data = {
        color: currentColor,
        size: currentBrushSize,
        // Normalize coordinates
        x1: x1 / canvas.width,
        y1: y1 / canvas.height,
        x2: x2 / canvas.width,
        y2: y2 / canvas.height,
    };
    socket.emit(SOCKET_EVENTS.DRAW_DATA, currentRoomId, data);
}


/**
 * Handles incoming drawing data from the server.
 * @param {object} data - The drawing data object received.
 */
export function handleIncomingDrawData(data) {
    if (!ctx || !canvas) return;

    // Denormalize coordinates
    const x1 = data.x1 !== undefined ? data.x1 * canvas.width : undefined;
    const y1 = data.y1 !== undefined ? data.y1 * canvas.height : undefined;
    const x2 = data.x2 !== undefined ? data.x2 * canvas.width : undefined;
    const y2 = data.y2 !== undefined ? data.y2 * canvas.height : undefined;

    // Server sends DRAWING_UPDATE for line segments
    if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
        drawLine(x1, y1, x2, y2, data.color, data.size);
    } else {
        console.warn("Received incomplete draw data:", data);
    }
}


// Exported clearCanvas now only clears locally, event emission is handled elsewhere.
/** Clears the entire canvas locally. */
export function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log("Canvas cleared locally via instruction.");
}

// --- Helpers ---

/**
 * Gets the correct coordinates relative to the canvas from a mouse or touch event.
 * @param {MouseEvent | Touch} e - The event object.
 * @returns {Array<number>} An array containing [x, y] coordinates.
 */
function getEventCoordinates(e) {
    if (!canvas) return [0, 0]; // Should not happen if initialized
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.clientX !== undefined) { // MouseEvent or Touch object
        clientX = e.clientX;
        clientY = e.clientY;
    } else { // Fallback for unexpected event types
        console.warn("Could not get coordinates from event:", e);
        return [lastX, lastY]; // Return last known coordinates
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return [x, y];
}