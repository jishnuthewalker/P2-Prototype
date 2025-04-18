import * as dom from './dom.js';

/**
 * Toggles the visibility of the full scoreboard section.
 */
export function toggleScoreboard() {
    const isExpanded = dom.toggleScoreBtn.getAttribute('aria-expanded') === 'true';
    dom.toggleScoreBtn.setAttribute('aria-expanded', !isExpanded);
    dom.fullScoreboardSection.classList.toggle('collapsed', isExpanded);
    dom.toggleScoreBtn.textContent = isExpanded ? 'Scores ▼' : 'Scores ▲';
    console.log(`Scoreboard toggled: ${!isExpanded ? 'Expanded' : 'Collapsed'}`);
}

/**
 * Toggles the collapsed state of a generic section.
 * @param {string} contentId - The ID of the content element to toggle.
 */
export function toggleSection(contentId) {
    const contentElement = document.getElementById(contentId);
    const buttonElement = document.querySelector(`[aria-controls="${contentId}"]`); // Find button controlling this content

    if (!contentElement || !buttonElement) {
        console.warn(`Could not find content or button for section toggle: ${contentId}`);
        return;
    }

    const isExpanded = buttonElement.getAttribute('aria-expanded') === 'true';
    buttonElement.setAttribute('aria-expanded', !isExpanded);
    contentElement.classList.toggle('collapsed', isExpanded); // Assuming 'collapsed' class handles hiding
    buttonElement.textContent = isExpanded ? '▼' : '▲'; // Update button indicator

    console.log(`Section ${contentId} toggled: ${!isExpanded ? 'Expanded' : 'Collapsed'}`);
}

// Add any other simple UI interaction handlers here as needed.