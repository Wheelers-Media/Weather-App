(() => {
  'use strict';

  let playing = false;
  let timer = null;
  let generation = 0;
  let inTick = false;

  const $ = q => document.querySelector(q);

  function isV8() {
    return document.documentElement.dataset.mapEngine === 'v8' && Boolean(window.StormLensMapV8?.map);
  }

  function slider() { return $('#radarTimeline'); }
  function playButton() { return $('#radarPlay'); }
  function statusLabel() { return $('#mapLayerStatus'); }

  function refreshIcons() {
    if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
  }

  function setPlayUI(on) {
    playing = on;
    document.documentElement.dataset.timelinePlaying = on ? 'true' : 'false';
    const button = playButton();
    if (button) {
      button.innerHTML = on ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
      button.setAttribute('aria-label', on ? 'Pause weather animation' : 'Play weather animation');
      button.setAttribute('aria-pressed', String(on));
    }
    refreshIcons();
  }

  function stop() {
    generation += 1;
    if (timer) clearTimeout(timer);
    timer = null;
    inTick = false;
    setPlayUI(false);
  }

  function rangeId() {
    return $('#stormlensTimelineRanges [data-v8-range].active')?.dataset.v8Range || '';
  }

  function isTimeSlider(input) {
    return Number(input?.max || 0) > 100000000000;
  }

  function stepAmount(input, direction=1) {
    const range = rangeId();
    if (isTimeSlider(input)) {
      const MINUTE = 60000;
      const HOUR = 3600000;
      if (range === '6h') return direction * 15 * MINUTE;
      if (range === '24h') return direction * 30 * MINUTE;
      if (range === '48h') return direction * HOUR;
      if (range === '90h' || range === '4d') return direction * HOUR;
      if (range === '14d') return direction * 3 * HOUR;
      return direction * Math.max(Number(input.step) || 15 * MINUTE, 15 * MINUTE);
    }

    if (range === '14d') return direction * 6;
    if (range === '90h' || range === '4d') return direction * 3;
    if (range === '48h') return direction * 2;
    return direction;
  }

  function dispatchSlider(value) {
    const input = slider();
    if (!input) return false;
    const min = Number(input.min || 0);
    const max = Number(input.max || 0);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || input.disabled) return false;
    input.value = String(Math.max(min, Math.min(max, value)));
    input.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
    input.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
    const pct = ((Number(input.value) - min) / Math.max(1, max - min)) * 100;
    input.style.setProperty('--v8-progress', `${Math.max(0, Math.min(100, pct))}%`);
    return true;
  }

  function nextValue(input, direction=1, wrap=true) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 0);
    const current = Number(input.value || min);
    const step = stepAmount(input, direction);
    let next = current + step;
    if (direction > 0 && next > max) next = wrap ? min : max;
    if (direction < 0 && next < min) next = wrap ? max : min;
    return next;
  }

  function playbackDelay(input) {
    const range = rangeId();
    if (isTimeSlider(input)) {
      if (range === '6h') return 230;
      if (range === '24h') return 280;
      return 330;
    }
    if (range === '1h' || range === '3h') return 520;
    if (range === '14d') return 760;
    return 650;
  }

  async function waitForRasterFrame(token) {
    const label = statusLabel();
    if (!label) {
      await new Promise(resolve => setTimeout(resolve, 650));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 30));
    const start = performance.now();
    while (playing && token === generation && performance.now() - start < 2600) {
      const text = String(label.textContent || '').toLowerCase();
      if (text.includes('unavailable') || text.includes('error') || text.includes('failed')) return;
      if (text.includes('live') && performance.now() - start > 100) return;
      await new Promise(resolve => setTimeout(resolve, 70));
    }
  }

  async function tick(token) {
    if (!playing || token !== generation || inTick || !isV8()) return;
    const input = slider();
    if (!input || input.disabled || Number(input.max) <= Number(input.min)) {
      stop();
      const label = statusLabel();
      if (label) label.textContent = 'No animation frames available';
      return;
    }

    inTick = true;
    try {
      const timeMode = isTimeSlider(input);
      const next = nextValue(input, 1, true);
      if (!dispatchSlider(next)) {
        stop();
        return;
      }
      if (!timeMode) await waitForRasterFrame(token);
      else await new Promise(resolve => setTimeout(resolve, playbackDelay(input)));
    } catch (error) {
      console.warn('[StormLens playback]', error);
      stop();
      const label = statusLabel();
      if (label) label.textContent = 'Playback error · tap Play to retry';
      return;
    } finally {
      inTick = false;
    }

    if (!playing || token !== generation) return;
    timer = setTimeout(() => tick(token), isTimeSlider(input) ? 0 : Math.max(80, playbackDelay(input) - 250));
  }

  function play() {
    if (!isV8()) return false;
    const input = slider();
    if (!input || input.disabled || Number(input.max) <= Number(input.min)) {
      const label = statusLabel();
      if (label) label.textContent = 'No animation frames available';
      return true;
    }
    generation += 1;
    const token = generation;
    setPlayUI(true);
    tick(token);
    return true;
  }

  function toggle() {
    if (playing) stop();
    else play();
  }

  function manualStep(direction) {
    if (!isV8()) return false;
    stop();
    const input = slider();
    if (!input || input.disabled || Number(input.max) <= Number(input.min)) return true;
    dispatchSlider(nextValue(input, direction, false));
    return true;
  }

  document.addEventListener('click', event => {
    if (!isV8()) return;
    if (event.target.closest?.('#radarPlay')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggle();
      return;
    }
    if (event.target.closest?.('#radarStepBack')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      manualStep(-1);
      return;
    }
    if (event.target.closest?.('#radarStepForward')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      manualStep(1);
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    if (isV8() && event.target.closest?.('#radarTimeline')) stop();
  }, true);

  document.addEventListener('click', event => {
    if (isV8() && event.target.closest?.('[data-v8-range]')) stop();
  }, true);

  window.addEventListener('stormlens:weather-layer-changed', stop);
  window.addEventListener('stormlens:v8-fatal', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

  window.StormLensPlaybackV9 = { play, stop, toggle, step:manualStep };
})();
