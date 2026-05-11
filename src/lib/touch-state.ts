// Module-level ref tracking how many touches are active on the document.
// Cell long-press timers consult this so that a second finger landing
// (which is the start of a pinch gesture) cancels the impending flag.
// Initialized by `useGlobalTouchTracker` in Game.tsx.
export const multiTouchRef = { current: 0 }
