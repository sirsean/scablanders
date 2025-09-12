export class WelcomePanel {
	static createWelcomePanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'welcome-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 640px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 20px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1050;
    `;

		// Base width and unified z-index for tiled layout
		(panel as any).dataset.baseWidth = '640';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
        <h3 style="margin:0;">Welcome to The Fringe</h3>
        <!-- No close button on purpose -->
      </div>
      <div class="crt-section" style="margin-bottom: 12px;">
        <p>
          Beyond the settled lanes lies an unexplored frontier — <b>The Fringe</b>. Those who venture here call themselves
          <b>Drifters</b>: some may be running from something; all are chasing something new — opportunity, discovery,
          and a future of their own making.
        </p>
        <p>
          Scablanders is a living world of scavenging and mining, of grit and upgrades — both personal and communal.
          Drifters compete and collaborate to build what comes next: growing the town’s shared defenses and economy while
          pursuing their own fortunes.
        </p>
      </div>
      <div class="crt-section" style="margin-bottom: 12px;">
        <h4 style="margin:0 0 8px 0;">What you’ll do</h4>
        <ul style="margin:0 0 8px 18px;">
          <li>Scout the wastes for resource nodes and opportunities</li>
          <li>Send teams on missions: scavenge, strip-mine, intercept, and protect</li>
          <li>Upgrade your drifters, vehicles, and the town itself</li>
          <li>Defend against monsters that stalk the perimeter</li>
        </ul>
        <p class="muted" style="margin:8px 0 0 0; font-size: 13px;">Excitement and adventure await those willing to brave The Scablands.</p>
      </div>
    `;

		// Ensure clicks inside don’t bubble to the map
		panel.addEventListener('click', (e) => e.stopPropagation());

		return panel;
	}
}
