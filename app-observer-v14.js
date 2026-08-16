(() => {
  'use strict';
  // Shared body-wide MutationObserver dispatcher.
  // Several small enhancement scripts (day-weather-v14, day-aqi-v14, day-status-v14,
  // premium-details-v12, timeline-polish-v14) each used to create their own independent
  // MutationObserver on document.body, so a single DOM change fired 5 separate observer
  // callbacks app-wide. This file creates ONE observer and lets each script register a
  // listener against it instead, cutting redundant observation/dispatch overhead.
  const listeners = [];
  function notify() {
    for (const fn of listeners) {
      try { fn(); } catch (_) { /* isolate listener failures */ }
    }
  }
  const observer = new MutationObserver(notify);
  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  window.StormLensAppObserve = function (fn) {
    if (typeof fn === 'function') listeners.push(fn);
  };
})();
