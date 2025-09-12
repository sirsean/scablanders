import { auth } from '../auth';

export class ConnectWalletPanel {
	static createConnectWalletPanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'connect-wallet-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 460px;
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

		(panel as any).dataset.baseWidth = '460';
		panel.style.zIndex = '1050';

		const hasWallet = typeof (window as any).ethereum !== 'undefined';

		panel.innerHTML = `
      <div style=\"display:flex; align-items:center; gap:8px; margin-bottom: 12px;\">
        <h3 style=\"margin:0;\">Join the Adventure</h3>
        <!-- No close button on purpose -->
      </div>
      <div class=\"crt-section\" style=\"margin-bottom: 12px;\">
        <p>Connect your Ethereum wallet to sign in and begin your life as a Drifter. You’ll play with your <b>Fringe Drifters NFTs</b> in-game.</p>
        <p class=\"muted\" style=\"font-size: 13px; margin: 6px 0 0 0;\">We use Sign-In with Ethereum (SIWE) to authenticate — no gas required. And no passwords, either.</p>
      </div>
      <div style=\"display:flex; gap:8px; align-items:center;\">
        <button id=\"connect-wallet-cta\">${hasWallet ? 'Connect Wallet' : 'Install a Wallet'}</button>
        <span id=\"connect-wallet-help\" class=\"muted\" style=\"font-size:12px;\"></span>
      </div>
    `;

		// Basic guidance for users without a wallet
		const help = panel.querySelector('#connect-wallet-help') as HTMLElement | null;
		if (help && !hasWallet) {
			help.innerHTML = `No wallet detected. You can install <a href=\"https://metamask.io\" target=\"_blank\" rel=\"noreferrer noopener\">MetaMask</a> to continue.`;
		}

		// Attach handler (works even if the action menu is hidden)
		setTimeout(() => {
			const btn = panel.querySelector('#connect-wallet-cta') as HTMLButtonElement | null;
			if (btn) {
				btn.addEventListener('click', async () => {
					if (!hasWallet) {
						window.open('https://metamask.io', '_blank', 'noreferrer');
						return;
					}
					try {
						btn.disabled = true;
						await auth.connect();
					} finally {
						btn.disabled = false;
					}
				});
			}
		}, 0);

		// Stop panel clicks from selecting the map
		panel.addEventListener('click', (e) => e.stopPropagation());

		return panel;
	}
}
