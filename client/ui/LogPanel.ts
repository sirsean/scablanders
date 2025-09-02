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

    panel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #FFD700;">Global Log</h3>
        <button id="close-log-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="log-content">
        <p>Loading...</p>
      </div>
    `;

    // Prevent clicks from bubbling to Phaser canvas
    panel.addEventListener('click', (e) => e.stopPropagation());

    return panel;
  }

  static renderLogItems(events: { timestamp: Date; message: string; playerAddress?: string }[]): string {
    if (!events || events.length === 0) {
      return '<p style="color:#888;">No events yet.</p>';
    }
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${events
          .map((ev) => {
            const time = LogPanel.formatTime(ev.timestamp);
            const who = ev.playerAddress ? `<span style=\"color:#aaa\">${ev.playerAddress.slice(0,6)}…</span> ` : '';
            return `
              <div style=\"border-left:2px solid #555; padding-left:8px;\">
                <div style=\"font-size:11px;color:#bbb;\">${time}</div>
                <div style=\"font-size:13px;\">${who}${ev.message}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  static updateLogPanel(allEvents: { timestamp: Date; message: string; playerAddress?: string }[]) {
    const content = document.getElementById('log-content');
    if (!content) return;
    content.innerHTML = LogPanel.renderLogItems(allEvents);
  }

  static startLiveTimer(getEvents: () => { timestamp: Date; message: string; playerAddress?: string }[]) {
    if (LogPanel.liveTimer) {
      clearInterval(LogPanel.liveTimer as any);
    }
    LogPanel.liveTimer = setInterval(() => {
      try {
        const events = getEvents();
        LogPanel.updateLogPanel(events);
      } catch (e) {
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
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

