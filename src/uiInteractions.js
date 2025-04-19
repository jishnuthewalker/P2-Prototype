// Removed unused dom import and toggle functions

/**
 * Makes an HTML element draggable by its handle.
 * @param {HTMLElement} elmnt - The element to make draggable.
 * @param {HTMLElement} handle - The element that acts as the drag handle (e.g., a header).
 */
export function makeDraggable(elmnt, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    // Use the provided handle element or the element itself if no handle is specified
    const dragHandle = handle || elmnt;

    dragHandle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault(); // Prevent default drag behavior (like text selection)
        // Get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position:
        // Ensure the element stays within the viewport boundaries (optional but recommended)
        const newTop = Math.max(0, Math.min(window.innerHeight - elmnt.offsetHeight, elmnt.offsetTop - pos2));
        const newLeft = Math.max(0, Math.min(window.innerWidth - elmnt.offsetWidth, elmnt.offsetLeft - pos1));

        elmnt.style.top = newTop + "px";
        elmnt.style.left = newLeft + "px";
        // Remove transform if it was used for initial centering
        elmnt.style.transform = 'none';
    }

    function closeDragElement() {
        // Stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}