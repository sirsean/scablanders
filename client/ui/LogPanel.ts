import type { GameEvent } from '@shared/models';
import { buildEventBorderStyle } from './utils/eventStyles';

export class LogPanel {
	private static liveTimer: number | null = null;

	static createLogPanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'log-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 700px;
      max-height: 600px;
      background: rgba(0,0,0,0.95);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1002;
    `;

		// Base width and unified z-index
		(panel as any).dataset.baseWidth = '700';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0;">Global Log</h3>
        <button id="close-log-panel" style="margin-left: auto;">✕</button>
      </div>
      <div id="log-content">
        <p>Loading...</p>
      </div>
    `;

		// Prevent clicks from bubbling to Phaser canvas
		panel.addEventListener('click', (e) => e.stopPropagation());

		return panel;
	}

	static renderLogItems(events: GameEvent[]): string {
		if (!events || events.length === 0) {
			return '<p class="muted">No events yet.</p>';
		}
		return `
	      <div class="log-items" style="display:flex; flex-direction:column; gap:8px;">
	        ${events
					.map((ev) => {
						const time = LogPanel.formatTime(ev.timestamp as any as Date);
						const who = ev.playerAddress ? `<span class=\"muted\">${ev.playerAddress.slice(0, 6)}…</span> ` : '';
						const style = buildEventBorderStyle((ev as any).type);
						const msg = LogPanel.renderMessageWithCenter(ev);
						return `
	              <div style=\"${style}\">
	                <div style=\"font-size:11px;\">${time}</div>
	                <div style=\"font-size:13px;\">${who}${msg}</div>
	              </div>
	            `;
					})
					.join('')}
	      </div>
	    `;
	}

	/**
	 * Only append a Center button when explicit coordinates are provided in ev.data.
	 * This avoids parsing message text and keeps the client simple and consistent.
	 */
	private static renderMessageWithCenter(ev: GameEvent): string {
		try {
			const dx = (ev as any)?.data?.x;
			const dy = (ev as any)?.data?.y;
			if (typeof dx === 'number' && typeof dy === 'number') {
				return `${LogPanel.escapeHtml(ev.message)} <button style="margin-left:8px; padding:2px 6px; font-size:11px;" onclick="centerOnMap(${dx}, ${dy})">Center</button>`;
			}
		} catch {}
		return LogPanel.escapeHtml(ev.message || '');
	}

	private static escapeHtml(s: string): string {
		return (s || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	static updateLogPanel(allEvents: GameEvent[]) {
		const content = document.getElementById('log-content');
		if (!content) {
			return;
		}
		content.innerHTML = LogPanel.renderLogItems(allEvents);
	}

	static startLiveTimer(getEvents: () => GameEvent[]) {
		if (LogPanel.liveTimer) {
			clearInterval(LogPanel.liveTimer as any);
		}
		LogPanel.liveTimer = setInterval(() => {
			try {
				const events = getEvents();
				LogPanel.updateLogPanel(events);
			} catch {
				// no-op
			}
		}, 1000) as any; // update every second
	}

	static stopLiveTimer() {
		if (LogPanel.liveTimer) {
			clearInterval(LogPanel.liveTimer as any);
			LogPanel.liveTimer = null;
		}
	}

	private static formatTime(timestamp: Date): string {
		const now = new Date().getTime();
		const t = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
		const diff = Math.max(0, now - t);
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) {
			return `${seconds}s ago`;
		}
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m ago`;
		}
		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h ago`;
		}
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
}
