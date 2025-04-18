import * as dom from './dom.js';
import * as socket from './socket.js'; // To send drawing data
import * as state from './state.js'; // To get room ID and drawing status
import { SOCKET_EVENTS } from './constants.js'; // To use correct event names

let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentBrushSize = 3;
let currentColor = '#000000';
// let canDraw = false; // Replaced by state.isCurrentUserDrawing() check or pointer-events style

/** Initializes the canvas and sets up event listeners. */
export function initCanvas() {
    canvas = dom.drawingCanvas;
    if (!canvas) {
        console.error("Drawing canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context from canvas!");
        return;
    }

    // Set initial canvas dimensions based on container size
    resizeCanvas();

    // Add event listeners
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

    // Set initial brush properties from DOM elements
    currentBrushSize = parseInt(dom.brushSizeSlider.value, 10);
    currentColor = dom.colorPicker.value;
    if(ctx) {
        ctx.lineWidth = currentBrushSize;
        ctx.strokeStyle = currentColor;
    }

    // Remove redundant listeners - these are now set in handlers.js/registerDOMListeners
    // dom.colorPicker.addEventListener('input', (e) => setColor(e.target.value));
    // dom.brushSizeSlider.addEventListener('input', (e) => setBrushSize(e.target.value));
    // dom.clearCanvasBtn.addEventListener('click', clearCanvas); // This is handled by handleClearCanvasClick in handlers.js

    console.log("Canvas initialized.");
    setDrawingEnabled(false); // Disabled by default, enabled/disabled via handlers.js -> handleNewTurn
}

/** Adjusts canvas size to fit its container. */
function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
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
    if (ctx) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = currentBrushSize;
        ctx.strokeStyle = currentColor;
    }
    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
}

/**
 * Enables or disables drawing controls and canvas interaction.
 * Called by handlers based on game state (e.g., handleNewTurn).
 */
export function setDrawingEnabled(enabled) {
    // canDraw = enabled; // No longer needed, rely on pointerEvents
    if (!canvas) return;
    canvas.style.cursor = enabled ? 'crosshair' : 'not-allowed';
    // Prevent events entirely when not allowed to draw
    canvas.style.pointerEvents = enabled ? 'auto' : 'none';
    // Disable/enable controls associated with drawing
    dom.colorPicker.disabled = !enabled;
    dom.brushSizeSlider.disabled = !enabled;
    dom.clearCanvasBtn.disabled = !enabled;
    console.log(`Drawing enabled: ${enabled}`);
}

/** Sets the current brush color (called by event listener in handlers.js). */
export function setCurrentColor(color) {
    currentColor = color;
    if (ctx) {
        ctx.strokeStyle = currentColor;
    }
    // console.log(`Brush color set to: ${color}`); // Less verbose logging
}

/** Sets the current brush size (called by event listener in handlers.js). */
export function setBrushSize(size) {
    currentBrushSize = parseInt(size, 10);
    if (ctx) {
        ctx.lineWidth = currentBrushSize;
    }
    // console.log(`Brush size set to: ${size}`); // Less verbose logging
}


function startDrawing(e) {
    // No need for canDraw check if pointerEvents is 'none'
    isDrawing = true;
    [lastX, lastY] = getEventCoordinates(e);
    // Optional: Draw a dot on click
    // drawLine(lastX, lastY, lastX, lastY);
    // sendDrawData('start', lastX, lastY); // Send start event
}

function draw(e) {
    // No need for canDraw check if pointerEvents is 'none'
    if (!isDrawing) return;
    const [currentX, currentY] = getEventCoordinates(e);

    // Draw locally first
    drawLine(lastX, lastY, currentX, currentY);
    // Send data for broadcast
    sendDrawData(lastX, lastY, currentX, currentY);

    [lastX, lastY] = [currentX, currentY];
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    // sendDrawData('stop'); // Send stop event
}

// --- Touch Event Handlers ---
function handleTouchStart(e) {
    // No need for canDraw check if pointerEvents is 'none'
    e.preventDefault(); // Prevent scrolling/default touch actions
    const touch = e.touches[0];
    startDrawing(touch);
}

function handleTouchMove(e) {
    // No need for canDraw check if pointerEvents is 'none'
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling/default touch actions
    const touch = e.touches[0];
    draw(touch);
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
 * @param {number} x1 - Start X coordinate.
 * @param {number} y1 - Start Y coordinate.
 * @param {number} x2 - End X coordinate.
 * @param {number} y2 - End Y coordinate.
 */
function sendDrawData(x1, y1, x2, y2) {
    const room = state.getRoom();
    if (!room || !canvas) return; // Don't send if not in a room or canvas not ready

    const data = {
        // type: 'draw', // Type is implicit in DRAW_DATA event
        color: currentColor,
        size: currentBrushSize,
        // Normalize coordinates
        x1: x1 / canvas.width,
        y1: y1 / canvas.height,
        x2: x2 / canvas.width,
        y2: y2 / canvas.height,
    };
    socket.emit(SOCKET_EVENTS.DRAW_DATA, room.id, data);
    // console.log("Sending draw data:", data); // Less verbose logging
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

    // Server now sends DRAWING_UPDATE for line segments
    // and CLEAR_CANVAS_UPDATE for clearing.
    // No need for switch based on data.type anymore if server sends distinct events.
    // Assuming handleIncomingDrawData is called for DRAWING_UPDATE events.

    if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
        drawLine(x1, y1, x2, y2, data.color, data.size);
    } else {
        console.warn("Received incomplete draw data:", data);
    }

    // Note: Clearing the canvas is now handled by a separate listener in handlers.js
    // which calls the exported clearCanvas function below (which only clears locally).
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
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.clientX !== undefined) { // MouseEvent
        clientX = e.clientX;
        clientY = e.clientY;
    } else if (e.touches && e.touches.length > 0) { // TouchEvent (use first touch)
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) { // TouchEvent (touchend)
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else { // Fallback or unexpected event type
        return [lastX, lastY]; // Return last known coordinates
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return [x, y];
}