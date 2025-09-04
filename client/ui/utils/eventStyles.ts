import type { GameEventType } from '@shared/models';

export type EventStyle = { color: string; width: number };

// Border-only emphasis mapping for game events
export function getEventStyle(type?: GameEventType): EventStyle {
  switch (type) {
    case 'mission_failed':
      return { color: '#ff4d4f', width: 3 }; // high
    case 'mission_intercepted':
      return { color: '#ffa940', width: 3 }; // high
    case 'resource_depleted':
      return { color: '#ff4d4f', width: 3 }; // high
    case 'mission_complete':
      return { color: '#52c41a', width: 2 }; // medium
    case 'node_spawned':
      return { color: '#1890ff', width: 2 }; // low
    case 'node_removed':
      return { color: '#8c8c8c', width: 2 }; // medium
    case 'town_upgrade':
      return { color: '#9254de', width: 2 }; // medium
    case 'mission_started':
      return { color: '#595959', width: 2 }; // low
    default:
      return { color: '#595959', width: 2 }; // default low
  }
}

// Build a full inline style string for the left border (optionally append extra styles)
export function buildEventBorderStyle(type?: GameEventType, extras?: string): string {
  const s = getEventStyle(type);
  const base = `border-left:${s.width}px solid ${s.color}; padding-left:8px;`;
  return extras ? `${base} ${extras}` : base;
}

