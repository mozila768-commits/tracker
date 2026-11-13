const PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  tasks: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  habits: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18"/><path d="M8 3v4M16 3v4"/>',
  chart: '<path d="M4 19.5V5"/><path d="M4 19.5h16"/><path d="M8 16.5v-4.5"/><path d="M12 16.5V8"/><path d="M16 16.5v-3"/>',
  trophy: '<path d="M8 20h8"/><path d="M12 16.5V20"/><path d="M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0V3.5z"/><path d="M7.5 5.5H4.5v1.2a3 3 0 0 0 3 3"/><path d="M16.5 5.5h3v1.2a3 3 0 0 1-3 3"/>',
  settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.1" fill="currentColor" stroke="none"/><circle cx="10" cy="17" r="2.1" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  pencil: '<path d="M13 20.5h8"/><path d="M16.2 3.8a2 2 0 0 1 2.8 2.8L8.2 17.4 4 18.6l1.2-4.2L16.2 3.8z"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9 7V4.8h6V7"/><path d="M8.2 7l.8 12.2h6l.8-12.2"/>',
  flame: '<path d="M12 2.8s5.2 5.2 5.2 9.2a5.2 5.2 0 0 1-10.4 0c0-1.8 1.6-3.4 1.6-3.4s.4 1.8 1.8 1.8c0-3.6 1.8-7.6 1.8-7.6z"/>',
  star: '<path d="M12 3.2l2.2 4.8 5.2.6-3.9 3.5 1.1 5.2L12 14.8 7.4 17.3l1.1-5.2L4.6 8.6l5.2-.6L12 3.2z"/>',
};

export function icon(name, size = 20) {
  const body = PATHS[name] || PATHS.grid;
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const CHECK_ICON = `<svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true"><path d="M4.6 10.3 L8.1 13.8 L15.6 6.1" fill="none" stroke="#fff" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
