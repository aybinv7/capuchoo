/**
 * Rules added inside every replayed page. A phone draws no scrollbars, but the replay runs in a
 * desktop browser that would draw one on each scrolling element, eating into the width the app
 * laid itself out for.
 */
export const REPLAY_STYLE_RULES = [
  "* { scrollbar-width: none !important; }",
  "::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }",
];
