export const APP_NAME = "ZagrajTo";
export const APP_TAGLINE = "Życzenia muzyczne od gości, prosto na tablicę DJ-a.";

export const NEW_EVENT_PATH = "/panel/wydarzenia/nowe";
export const eventPanelPath = (eventId: string) => `/panel/wydarzenia/${eventId}`;
export const eventPosterPath = (eventId: string) => `/panel/wydarzenia/${eventId}/plakat`;
export const guestEventPath = (code: string) => `/e/${code}`;
/** Plan and billing (ticket 012). Upgrade links for locked Pro features point here. */
export const SUBSCRIPTION_PATH = "/panel/subskrypcja";

/** Background of the always-dark screens (guest page, DJ board, public site): browser chrome and the installed app. */
export const DARK_THEME_COLOR = "#09090b";
/** The panel header in dark mode (Tailwind zinc-900), also behind the DJ board. */
export const PANEL_DARK_HEADER_COLOR = "#18181b";
