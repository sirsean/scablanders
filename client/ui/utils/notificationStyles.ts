export type NotificationStyle = { background: string; border: string };

// Map GameNotification types to background and border colors
export function getNotificationStyle(type: string): NotificationStyle {
	switch (type) {
		case 'success':
			return { background: 'rgba(0, 150, 0, 0.9)', border: '#00ff00' };
		case 'error':
			return { background: 'rgba(150, 0, 0, 0.9)', border: '#ff0000' };
		case 'mission':
			return { background: 'rgba(0, 100, 150, 0.9)', border: '#0088ff' };
		case 'combat':
			return { background: 'rgba(150, 100, 0, 0.9)', border: '#ffaa00' };
		case 'info':
			return { background: 'rgba(60, 60, 60, 0.95)', border: '#888888' };
		default:
			return { background: 'rgba(100, 100, 100, 0.9)', border: '#888888' };
	}
}

// Build full inline style string for a toast (adds border-left accent)
export function buildNotificationStyle(type: string, extras?: string): string {
	const s = getNotificationStyle(type);
	const base = `background: ${s.background}; border: 1px solid ${s.border}; border-left: 4px solid ${s.border};`;
	return extras ? `${base} ${extras}` : base;
}
