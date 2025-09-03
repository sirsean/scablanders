import { gameState } from '../gameState';

export class DrifterInfoPanel {
  private static panelEl: HTMLElement | null = null;
  private static currentTokenId: number | null = null;
  private static readonly XP_BASE = 100;
  private static readonly XP_GROWTH = 1.5;

  static createDrifterInfoPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'drifter-info-panel';
    panel.className = 'game-panel';
    panel.style.cssText = `
      position: fixed;
      width: 500px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1060;
    `;

    panel.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
        <h3 id="drifter-info-title" style="margin:0; color:#FFD700;">Drifter</h3>
        <button id="close-drifter-info" style="margin-left:auto; background:none; border:1px solid #666; color:#fff; padding:4px 8px; cursor:pointer;">✕</button>
      </div>
      <div id="drifter-info-content">
        <p>Loading...</p>
      </div>
    `;

    // Prevent clicks from propagating
    panel.addEventListener('click', (e) => e.stopPropagation());

    // Close button
    panel.querySelector('#close-drifter-info')?.addEventListener('click', () => DrifterInfoPanel.close());

    DrifterInfoPanel.panelEl = panel;
    return panel;
  }

  static open(tokenId: number) {
    DrifterInfoPanel.currentTokenId = tokenId;
    if (!DrifterInfoPanel.panelEl) return;
    DrifterInfoPanel.render();
    DrifterInfoPanel.panelEl.style.display = 'block';
  }

  static close() {
    if (!DrifterInfoPanel.panelEl) return;
    DrifterInfoPanel.panelEl.style.display = 'none';
    DrifterInfoPanel.currentTokenId = null;
  }

  private static xpToNext(level: number): number {
    const l = Math.max(1, level);
    return Math.ceil(DrifterInfoPanel.XP_BASE * Math.pow(DrifterInfoPanel.XP_GROWTH, l - 1));
  }

  static render() {
    if (!DrifterInfoPanel.panelEl) return;
    const content = DrifterInfoPanel.panelEl.querySelector('#drifter-info-content') as HTMLElement;
    const tokenId = DrifterInfoPanel.currentTokenId;
    if (!content || tokenId == null) return;

    const state = gameState.getState();
    const drifter = state.ownedDrifters.find((d) => d.tokenId === tokenId);
    const dp = state.profile?.drifterProgress?.[String(tokenId)];

    if (!drifter) {
      content.innerHTML = `<p style="color:#ff6b6b;">Drifter #${tokenId} not found in your collection.</p>`;
      return;
    }

    const bonuses = dp?.bonuses || { combat: 0, scavenging: 0, tech: 0, speed: 0 };
    const lvl = dp?.level || 1;
    const xp = dp?.xp || 0;
    const xpNext = DrifterInfoPanel.xpToNext(lvl);
    const pct = Math.max(0, Math.min(100, Math.floor((xp / xpNext) * 100)));

    (DrifterInfoPanel.panelEl.querySelector('#drifter-info-title') as HTMLElement).textContent = `Drifter #${tokenId} - ${drifter.name}`;

    content.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
        <img src="/images/drifters/thumbnails/${tokenId}.jpeg" alt="#${tokenId}" style="width:96px;height:96px;object-fit:cover;border-radius:6px;border:1px solid #333;" onerror="this.style.display='none'" />
        <div style="flex:1;">
          <div style="font-size:14px;">Level: <span style="color:#ffd700; font-weight:bold;">${lvl}</span></div>
          <div style="font-size:12px;">XP: ${xp} / ${xpNext}</div>
          <div style="background:#333; height:8px; border-radius:4px; overflow:hidden; margin-top:4px;">
            <div style="background:linear-gradient(90deg,#00c853,#aeea00); width:${pct}%; height:100%;"></div>
          </div>
          <div style="font-size:12px; color:#ccc; margin-top:6px;">Unspent Points: <strong style="color:#00ffcc;">${dp?.unspentPoints || 0}</strong></div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
        <div style="border:1px solid #444; border-radius:6px; padding:8px;">
          <div style="color:#aaa; font-weight:bold; margin-bottom:6px;">Base Stats</div>
          <div style="font-size:12px; color:#ccc;">Combat: ${drifter.combat}</div>
          <div style="font-size:12px; color:#ccc;">Scavenging: ${drifter.scavenging}</div>
          <div style="font-size:12px; color:#ccc;">Tech: ${drifter.tech}</div>
          <div style="font-size:12px; color:#ccc;">Speed: ${drifter.speed}</div>
        </div>
        <div style="border:1px solid #444; border-radius:6px; padding:8px;">
          <div style="color:#aaa; font-weight:bold; margin-bottom:6px;">Bonus Stats</div>
          <div style="font-size:12px; color:#ccc;">Combat: +${bonuses.combat || 0}</div>
          <div style="font-size:12px; color:#ccc;">Scavenging: +${bonuses.scavenging || 0}</div>
          <div style="font-size:12px; color:#ccc;">Tech: +${bonuses.tech || 0}</div>
          <div style="font-size:12px; color:#ccc;">Speed: +${bonuses.speed || 0}</div>
        </div>
      </div>

      <div style="border:1px solid #444; border-radius:6px; padding:8px; margin-bottom:12px;">
        <div style="color:#aaa; font-weight:bold; margin-bottom:6px;">Effective Stats</div>
        <div style="font-size:12px; color:#ccc;">Combat: ${drifter.combat + (bonuses.combat||0)}</div>
        <div style="font-size:12px; color:#ccc;">Scavenging: ${drifter.scavenging + (bonuses.scavenging||0)}</div>
        <div style="font-size:12px; color:#ccc;">Tech: ${drifter.tech + (bonuses.tech||0)}</div>
        <div style="font-size:12px; color:#ccc;">Speed: ${drifter.speed + (bonuses.speed||0)}</div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
        ${['combat','scavenging','tech','speed'].map(attr => `
          <button class="alloc-btn" data-attr="${attr}" ${((dp?.unspentPoints||0) > 0 ? '' : 'disabled')} style="padding:8px; background:${(dp?.unspentPoints||0)>0?'#2c5530':'#444'}; border:1px solid #666; color:#fff; border-radius:4px; cursor:${(dp?.unspentPoints||0)>0?'pointer':'not-allowed'};">
            +1 ${attr.charAt(0).toUpperCase()+attr.slice(1)}
          </button>
        `).join('')}
      </div>
    `;

    // Hook allocation buttons
    content.querySelectorAll('.alloc-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const attr = (btn as HTMLElement).getAttribute('data-attr') as 'combat'|'scavenging'|'tech'|'speed';
        const id = DrifterInfoPanel.currentTokenId;
        if (!id || !attr) return;
        (btn as HTMLButtonElement).disabled = true;
        await gameState.allocateDrifterPoint(id, attr);
        DrifterInfoPanel.render();
      });
    });
  }
}

