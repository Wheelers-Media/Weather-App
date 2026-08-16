(() => {
  'use strict';
  // Shared body-wide MutationObserver dispatcher.
  // Several small enhancement scripts (day-weather-v14, day-aqi-v14, day-status-v14,
  // premium-details-v12, timeline-polish-v14) each used to create their own independent
  // MutationObserver on document.body, so a single DOM change fired 5 separate observer
  // callbacks app-wide.
  //
  // Two perf issues found after shipping the single-observer version:
  // 1. High-frequency DOM writers (radar timeline text/slider updates during scrubbing,
  //    tab-switch classList toggles) fired the full listener fan-out on every mutation
  //    batch, even though none of the listeners care about those particular changes.
  // 2. Several listeners do their own querySelector/localStorage work before bailing
  //    out early, so the fan-out cost scaled with app-wide DOM churn, not with actual
  //    relevant changes.
  //
  // Fix: coalesce bursts into at most one dispatch per animation frame (mutations
  // during a single scrub/tab-switch collapse into one notify instead of one per
  // mutation record batch), and skip the dispatch entirely while nothing is listening.
  const listeners = [];
  let scheduled = false;

  function runListeners() {
    scheduled = false;
    for (const fn of listeners) {
      try { fn(); } catch (_) { /* isolate listener failures */ }
    }
  }

  function notify() {
    if (!listeners.length || scheduled) return;
    scheduled = true;
    requestAnimationFrame(runListeners);
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
