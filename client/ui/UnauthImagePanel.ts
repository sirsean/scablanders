import scablandersUrl from '../assets/images/scablanders.png';

export class UnauthImagePanel {
  static createUnauthImagePanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'unauth-image-panel';
    panel.className = 'game-panel';
    panel.style.cssText = `
      position: fixed;
      width: 720px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 12px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow: hidden;
      z-index: 1050;
    `;

    (panel as any).dataset.baseWidth = '720';

    // Simple header without a close button
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; margin-bottom:8px;';
    const h3 = document.createElement('h3');
    h3.textContent = 'Scablanders';
    h3.style.margin = '0';
    header.appendChild(h3);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; align-items:center; justify-content:center;';

    const img = document.createElement('img');
    img.src = scablandersUrl;
    img.alt = 'Scablanders key art';
    img.style.cssText = 'width:100%; height:auto; max-height: calc(80vh - 84px); border-radius:6px; border:1px solid #333; object-fit:contain;';

    wrapper.appendChild(img);

    panel.appendChild(header);
    panel.appendChild(wrapper);

    // Prevent bubbling to the Phaser canvas
    panel.addEventListener('click', (e) => e.stopPropagation());

    return panel;
  }
}
