(() => {
  const visual = document.querySelector('.energy-visual');
  const flow = document.querySelector('#energy-flow');
  const updateFlow = () => {
    const value = Number(flow.textContent.replace('−', '-').replace(/[^\d.+-]/g, ''));
    visual.dataset.state = value < -0.1 ? 'charging' : value > 0.1 ? 'discharging' : 'idle';
    visual.querySelector('.energy-state').textContent = value < -0.1 ? 'REGENERATION · WHEELS TO BATTERY' : value > 0.1 ? 'TRACTION · BATTERY TO WHEELS' : 'ENERGY FLOW · IDLE';
  };
  new MutationObserver(updateFlow).observe(flow, { childList: true, characterData: true, subtree: true });
  updateFlow();
  for (const mirror of document.querySelectorAll('[data-mirror]')) {
    const source = document.getElementById(mirror.dataset.mirror);
    const update = () => { if (mirror.textContent !== source.textContent) mirror.textContent = source.textContent; };
    new MutationObserver(update).observe(source, { childList: true, characterData: true, subtree: true });
    update();
  }
  for (const id of ['n8n-decision-status', 'n8n-decision-source', 'capture-status', 'capture-detail', 'assist']) {
    const element = document.getElementById(id);
    const rename = () => {
      const old = element.textContent;
      const next = old.replace(/n8n/gi, 'RegenX');
      if (old !== next) element.textContent = next;
    };
    new MutationObserver(rename).observe(element, { childList: true, characterData: true, subtree: true });
    rename();
  }
})();
