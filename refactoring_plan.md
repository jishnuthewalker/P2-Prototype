# Refactoring Plan for Kaliyo Client

## Assessment

Based on the review of `src/main.js`, `src/socket.js`, and `src/ui.js`, the current architecture has the following characteristics:

1.  **Centralized Logic Hub:** `src/main.js` acts as the core, housing a large `appState` object managed by `petite-vue`. This object holds most of the application's state and orchestrates almost all actions.
2.  **Mixed UI Update Strategies:** The application uses both declarative (`petite-vue` bindings in HTML) and imperative (`ui.js` DOM manipulation) approaches for UI updates.
3.  **Separated Concerns (Partial):** While `socket.js` encapsulates connection logic and `ui.js` encapsulates DOM manipulation details, the *coordination* and *handling* of events and state changes largely reside within the monolithic `appState` in `main.js`.

A refactor is recommended to improve maintainability, readability, testability, and better leverage the `petite-vue` framework.

## Proposed Refactoring Approach

The goal is to create a more modular, maintainable, and consistent architecture by:

1.  **Consolidating State Management:** Embrace `petite-vue`'s reactivity more fully. Move state currently managed implicitly through `ui.js` calls (e.g., player lists, chat messages) into the reactive `appState`.
2.  **Declarative UI:** Modify the HTML (`Kaliyo.html`) to render these parts of the UI directly from the reactive `appState` using `petite-vue` directives (`v-for`, `v-if`, etc.). This would allow removing large portions of `ui.js`.
3.  **Modularizing Logic:** Break down the responsibilities currently within `appState` methods and socket handlers in `main.js`. Socket event handlers should update the reactive state directly, letting `petite-vue` handle the resulting UI changes automatically.

## Plan Outline

```mermaid
graph TD
    A[Analyze Kaliyo.html] --> B{Identify UI elements updated by ui.js};
    B --> C[Modify appState in main.js];
    C --> D[Add reactive properties for lists/data (players, messages)];
    D --> E[Update socket handlers in main.js];
    E --> F[Modify handlers to update new reactive state properties];
    F --> G[Refactor Kaliyo.html];
    G --> H[Use v-for, v-if etc. to bind to new reactive state];
    H --> I[Remove corresponding functions from ui.js];
    I --> J[Remove calls to removed ui.js functions from main.js];
    J --> K[Test Thoroughly];
```

**Steps:**

1.  **Analyze `Kaliyo.html`:** Understand current `petite-vue` usage and identify UI parts updated by `ui.js`.
2.  **Refactor `appState` (`main.js`):** Add reactive properties for data like player lists and messages.
3.  **Refactor Socket Handlers (`main.js`):** Update handlers to modify the new reactive state properties directly.
4.  **Refactor `Kaliyo.html`:** Use `petite-vue` directives (`v-for`, `v-if`, etc.) to render UI based on the reactive state.
5.  **Refactor `ui.js`:** Remove functions made redundant by the declarative UI updates.
6.  **Cleanup `main.js`:** Remove calls to the deleted `ui.js` functions.
7.  **Testing:** Thoroughly test all application features.