import * as dom from './dom.js';
import * as socket from './socket.js'; // To send drawing data

let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentBrushSize = 3;
let currentColor = '#000000';
let canDraw = false; // Controlled by game logic (is it my turn?)

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

    // Set initial brush properties
    setBrushSize(dom.brushSizeSlider.value);
    setColor(dom.colorPicker.value);

    // Setup listeners for controls
    dom.colorPicker.addEventListener('input', (e) => setColor(e.target.value));
    dom.brushSizeSlider.addEventListener('input', (e) => setBrushSize(e.target.value));
    dom.clearCanvasBtn.addEventListener('click', clearCanvas);

    console.log("Canvas initialized.");
    setDrawingEnabled(false); // Disabled by default
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

/** Enables or disables drawing on the canvas. */
export function setDrawingEnabled(enabled) {
    canDraw = enabled;
    canvas.style.cursor = enabled ? 'crosshair' : 'not-allowed';
    canvas.style.pointerEvents = enabled ? 'auto' : 'none'; // Also control pointer events
    // Disable/enable controls
    dom.colorPicker.disabled = !enabled;
    dom.brushSizeSlider.disabled = !enabled;
    dom.clearCanvasBtn.disabled = !enabled;
    console.log(`Drawing enabled: ${enabled}`);
}

function startDrawing(e) {
    if (!canDraw) return;
    isDrawing = true;
    [lastX, lastY] = getEventCoordinates(e);
    // Optional: Draw a dot on click
    // drawLine(lastX, lastY, lastX, lastY);
    // sendDrawData('start', lastX, lastY); // Send start event
}

function draw(e) {
    if (!isDrawing || !canDraw) return;
    const [currentX, currentY] = getEventCoordinates(e);

    drawLine(lastX, lastY, currentX, currentY);
    sendDrawData('draw', lastX, lastY, currentX, currentY); // Send draw segment

    [lastX, lastY] = [currentX, currentY];
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    // sendDrawData('stop'); // Send stop event
}

// --- Touch Event Handlers ---
function handleTouchStart(e) {
    if (!canDraw) return;
    e.preventDefault(); // Prevent scrolling/default touch actions
    const touch = e.touches[0];
    startDrawing(touch);
}

function handleTouchMove(e) {
    if (!isDrawing || !canDraw) return;
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

/** Clears the entire canvas. */
export function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log("Canvas cleared.");
    if (canDraw) { // Only send clear event if the current user initiated it
       sendDrawData('clear');
    }
}

/** Sets the current brush color. */
export function setColor(color) {
    currentColor = color;
    if (ctx) {
        ctx.strokeStyle = currentColor;
    }
    console.log(`Brush color set to: ${color}`);
}

/** Sets the current brush size. */
export function setBrushSize(size) {
    currentBrushSize = parseInt(size, 10);
    if (ctx) {
        ctx.lineWidth = currentBrushSize;
    }
    console.log(`Brush size set to: ${size}`);
}

// --- Data Handling ---

/**
 * Sends drawing data to the server via socket.
 * @param {string} type - Type of drawing action ('draw', 'clear', 'start', 'stop').
 * @param {number} [x1] - Start X (for 'draw', 'start').
 * @param {number} [y1] - Start Y (for 'draw', 'start').
 * @param {number} [x2] - End X (for 'draw').
 * @param {number} [y2] - End Y (for 'draw').
 */
function sendDrawData(type, x1, y1, x2, y2) {
    const data = {
        type: type,
        color: currentColor,
        size: currentBrushSize,
        // Normalize coordinates to relative values (0 to 1) for different screen sizes
        x1: x1 !== undefined ? x1 / canvas.width : undefined,
        y1: y1 !== undefined ? y1 / canvas.height : undefined,
        x2: x2 !== undefined ? x2 / canvas.width : undefined,
        y2: y2 !== undefined ? y2 / canvas.height : undefined,
    };
    // socket.emit('drawData', data); // TODO: Uncomment when socket is fully integrated
    // console.log("Sending draw data:", data); // For debugging
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

    switch (data.type) {
        case 'draw':
            if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
                drawLine(x1, y1, x2, y2, data.color, data.size);
            }
            break;
        case 'clear':
            // Don't call clearCanvas() directly as it sends another event
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            console.log("Received clear canvas instruction.");
            break;
        // Handle 'start' and 'stop' if needed for smoother remote drawing (optional)
        case 'start':
             // Optional: Could draw a dot or prepare state
             // drawLine(x1, y1, x1, y1, data.color, data.size);
             break;
        case 'stop':
             // Optional: Finalize any drawing path state
             break;
        default:
            console.warn("Unknown draw data type received:", data.type);
    }
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