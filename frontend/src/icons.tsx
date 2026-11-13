const PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  tasks: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  habits: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18"/><path d="M8 3v4M16 3v4"/>',
  chart: '<path d="M4 19.5V5"/><path d="M4 19.5h16"/><path d="M8 16.5v-4.5"/><path d="M12 16.5V8"/><path d="M16 16.5v-3"/>',
  trophy: '<path d="M8 20h8"/><path d="M12 16.5V20"/><path d="M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0V3.5z"/><path d="M7.5 5.5H4.5v1.2a3 3 0 0 0 3 3"/><path d="M16.5 5.5h3v1.2a3 3 0 0 1-3 3"/>',
  settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.1" fill="currentColor" stroke="none"/><circle cx="10" cy="17" r="2.1" fill="currentColor" stroke="none"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 8v4.5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  pencil: '<path d="M13 20.5h8"/><path d="M16.2 3.8a2 2 0 0 1 2.8 2.8L8.2 17.4 4 18.6l1.2-4.2L16.2 3.8z"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9 7V4.8h6V7"/><path d="M8.2 7l.8 12.2h6l.8-12.2"/>',
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || PATHS.grid }}
    />
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
      <path d="M4.6 10.3 L8.1 13.8 L15.6 6.1" fill="none" stroke="#fff" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
