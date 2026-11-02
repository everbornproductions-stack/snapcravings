// Launch switches. Flip PLAY_LIVE to true on the day Google Play approves app.snapcravings.twa,
// then bump the ?v= cache tag in index.html and VERSION in sw.js, and deploy.
window.SC_CONFIG = {
  PLAY_LIVE: false,
  PLAY_URL: 'https://play.google.com/store/apps/details?id=app.snapcravings.twa',
  PLAY_MARKET: 'market://details?id=app.snapcravings.twa',
  SHARE_URL: 'https://snapcravings.pages.dev/?ref=share'
};
