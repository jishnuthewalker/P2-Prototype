import * as constants from './constants.js';

// NOTE: Most UI update logic has been removed from this file.
// UI updates are now primarily handled declaratively in Kaliyo.html
// using petite-vue bindings (:class, v-if, v-for, v-text, v-model, etc.)
// reacting to changes in the `appState` object defined in `src/main.js`.

// --- Hint Modal UI ---

/**
 * Populates the hint modal with Kannada alphabet characters and pronunciations.
 * @param {string} contentElementId - The ID of the element to populate.
 */
export function populateHintModal(contentElementId) {
    const contentContainer = document.getElementById(contentElementId);
    if (!contentContainer) {
        console.warn(`populateHintModal called but element with ID '${contentElementId}' not found.`);
        return;
    }
    contentContainer.innerHTML = ''; // Clear loading message or previous content

    constants.KANNADA_ALPHABET.forEach(letter => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('hint-item'); // Use class from style.css

        const kannadaSpan = document.createElement('span');
        kannadaSpan.classList.add('hint-kannada');
        kannadaSpan.textContent = letter.script;

        const latinSpan = document.createElement('span');
        latinSpan.classList.add('hint-latin');
        // Display both standard Latin and simplified QWERTY
        latinSpan.textContent = `(${letter.latin} / ${letter.qwerty})`;

        itemDiv.appendChild(kannadaSpan);
        itemDiv.appendChild(latinSpan);
        contentContainer.appendChild(itemDiv);
    });
}