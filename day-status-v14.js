(() => {
  'use strict';
  let selectedDay = 0;
  function renderStatus() {
    const body = document.getElementById('v12DayBody');
    const grid = body?.querySelector('.v12-metric-grid');
    if (!body || !grid || document.getElementById('v12DayDetail')?.hidden) return;
    grid.querySelector('[data-v14-day-status]')?.remove();
    const currentCount = Number(document.querySelector('#v12AlertHub .v12-alert-count')?.textContent || 0);
    const card = document.createElement('div');
    card.className = 'v12-metric';
    card.dataset.v14DayStatus = 'true';
    if (selectedDay === 0) {
      card.innerHTML = `<small>Weather warnings</small><strong>${currentCount ? currentCount + ' active' : 'None'}</strong><p>${currentCount ? 'Active official warning coverage affects this selected location.' : 'No active official warning coverage for this location right now.'}</p>`;
    } else {
      card.innerHTML = `<small>Weather warnings</small><strong>${currentCount ? currentCount + ' active now' : 'None active now'}</strong><p>Future-day warnings can be issued or changed as the date gets closer.</p>`;
    }
    grid.appendChild(card);
  }
  function choose(row) {
    selectedDay = Number(row?.dataset?.v12Day) || 0;
    setTimeout(renderStatus, 150);
  }
  document.addEventListener('click', event => {
    const row = event.target.closest?.('.day-row[data-v12-day]');
    if (row) choose(row);
  }, true);
  document.addEventListener('keydown', event => {
    const row = event.target.closest?.('.day-row[data-v12-day]');
    if (row && (event.key === 'Enter' || event.key === ' ')) choose(row);
  }, true);
  new MutationObserver(() => requestAnimationFrame(renderStatus)).observe(document.body,{childList:true,subtree:true});
})();
