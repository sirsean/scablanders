// client/ui/crtTheme.ts
// Initializes CRT overlay and accessibility-friendly toggle.

export type CrtOptions = {
	rootSelector?: string;
	storageKey?: string;
	enableToggleButton?: boolean;
	defaultEnabled?: boolean;
};

const DEFAULTS = {
	storageKey: 'scbl.crtEffects',
	enableToggleButton: true,
	defaultEnabled: true,
};

type ResolvedOptions = Required<Omit<CrtOptions, 'rootSelector'>> & Pick<CrtOptions, 'rootSelector'>;

function getPrefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getSaved(storageKey: string): 'on' | 'off' | null {
	try {
		const v = localStorage.getItem(storageKey);
		return v === 'on' || v === 'off' ? v : null;
	} catch {
		return null;
	}
}

function save(storageKey: string, v: 'on' | 'off') {
	try {
		localStorage.setItem(storageKey, v);
	} catch {
		/* ignore */
	}
}

function ensureThemeAttrs() {
	const root = document.documentElement;
	if (!root.getAttribute('data-theme')) {
		root.setAttribute('data-theme', 'crt');
	}
	if (!root.getAttribute('data-crt-effects')) {
		root.setAttribute('data-crt-effects', 'on');
	}
}

function createOverlay(): HTMLElement {
	let el = document.getElementById('crt-overlay');
	if (!el) {
		el = document.createElement('div');
		el.id = 'crt-overlay';
		document.body.appendChild(el);
	}
	return el;
}

function createToggleButton(onToggle: (next: boolean) => void): HTMLButtonElement {
	let btn = document.getElementById('crt-toggle') as HTMLButtonElement | null;
	if (btn) {
		return btn;
	}

	btn = document.createElement('button');
	btn.id = 'crt-toggle';
	btn.type = 'button';
	btn.setAttribute('aria-label', 'Toggle CRT visual effects');
	btn.setAttribute('aria-pressed', 'true');
	btn.textContent = 'CRT';
	btn.style.cssText = [
		'position: fixed',
		'right: 10px',
		'bottom: 10px',
		'z-index: 2147483647', // above overlay
		'padding: 6px 10px',
		'font: 12px/1 var(--crt-font-stack, ui-monospace, monospace)',
		'color: var(--crt-amber, #ffcc66)',
		'background: rgba(16,20,16,0.85)',
		'border: 1px solid rgba(255,204,102,0.45)',
		'border-radius: 2px',
		'text-shadow: 0 0 2px rgba(255,204,102,0.45)',
		'box-shadow: 0 2px 10px rgba(0,0,0,0.5)',
		'cursor: pointer',
	].join(';');

	btn.addEventListener('click', () => {
		const root = document.documentElement;
		const isOn = root.getAttribute('data-crt-effects') !== 'off';
		const next = !isOn;
		root.setAttribute('data-crt-effects', next ? 'on' : 'off');
		btn!.setAttribute('aria-pressed', next ? 'true' : 'false');
		if (next) {
			createOverlay();
		}
		onToggle(next);
	});

	document.body.appendChild(btn);
	return btn;
}

function randomizePanelFlicker(root: ParentNode) {
	const reduce = getPrefersReducedMotion();
	if (reduce) {
		return;
	}
	const nodes = root.querySelectorAll<HTMLElement>('.game-panel, .crt-section');
	nodes.forEach((el) => {
		// Skip if already initialized
		if ((el as any).__crtFlickerInit) {
			return;
		}
		(el as any).__crtFlickerInit = true;
		const dur = (1.6 + Math.random() * 2.4).toFixed(2) + 's';
		const delay = (Math.random() * 2.8).toFixed(2) + 's';
		const amt = (0.04 + Math.random() * 0.06).toFixed(3);
		el.style.setProperty('--panel-flicker-duration', dur);
		el.style.setProperty('--panel-flicker-delay', delay);
		el.style.setProperty('--panel-flicker-amt', amt);
	});
}

export function initCrtTheme(options: CrtOptions = {}) {
	const opts: ResolvedOptions = { ...DEFAULTS, ...options } as ResolvedOptions;

	ensureThemeAttrs();

	// Determine initial state
	const reduce = getPrefersReducedMotion();
	const saved = getSaved(opts.storageKey);
	const shouldEnable = saved ? saved === 'on' : reduce ? false : opts.defaultEnabled !== false;

	// Apply
	document.documentElement.setAttribute('data-theme', 'crt');
	document.documentElement.setAttribute('data-crt-effects', shouldEnable ? 'on' : 'off');
	if (shouldEnable) {
		createOverlay();
	}

	// Initialize per-panel flicker on existing elements
	try {
		randomizePanelFlicker(document);
	} catch {}

	// Observe future DOM additions to apply random flicker vars
	try {
		const obs = new MutationObserver((mutations) => {
			for (const m of mutations) {
				m.addedNodes.forEach((n) => {
					if (n.nodeType === Node.ELEMENT_NODE) {
						const el = n as HTMLElement;
						if (el.matches?.('.game-panel, .crt-section')) {
							randomizePanelFlicker(el.parentNode || document);
						} else if (el.querySelector) {
							randomizePanelFlicker(el);
						}
					}
				});
			}
		});
		obs.observe(document.body, { childList: true, subtree: true });
	} catch {}

	// React to OS motion preference changes (only if user hasn't set an explicit preference)
	try {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const handler = (e: MediaQueryListEvent) => {
			if (getSaved(opts.storageKey) == null) {
				const enable = !e.matches;
				document.documentElement.setAttribute('data-crt-effects', enable ? 'on' : 'off');
				if (enable) {
					createOverlay();
				}
			}
		};
		// safari and older support addListener; modern uses addEventListener
		// @ts-ignore - handle both
		mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
	} catch {
		/* ignore */
	}

	// Toggle UI
	if (opts.enableToggleButton) {
		const btn = createToggleButton((next: boolean) => {
			save(opts.storageKey, next ? 'on' : 'off');
		});
		btn.setAttribute('aria-pressed', shouldEnable ? 'true' : 'false');
	}
}
