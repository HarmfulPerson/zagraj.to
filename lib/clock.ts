/** Returns the current time in milliseconds. Injected into time-based helpers so tests can control it. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();
