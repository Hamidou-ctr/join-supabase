// Avatar colors for new contacts. The DB only checks the #RRGGBB shape; the palette is a UI choice.
export const CONTACT_COLORS = [
  '#FF7A00', '#FF5EB3', '#6E52FF', '#9327FF', '#00BEE8', '#1FD7C1',
  '#FF745E', '#FFA35E', '#FC71FF', '#FFC701', '#0038FF', '#C3FF2B',
  '#FFE62B', '#FF4646', '#FFBB2B',
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function pickColor(seed) {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return CONTACT_COLORS[hash % CONTACT_COLORS.length];
}

// Data from the DB is not trusted for styling either: anything but #RRGGBB falls back.
export function safeColor(color) {
  return HEX_COLOR.test(color) ? color : CONTACT_COLORS[0];
}

// Groups by first letter (A-Z, everything else under '#'), sorted alphabetically.
export function groupContacts(contacts) {
  const sorted = [...contacts].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  const groups = new Map();
  for (const contact of sorted) {
    const first = contact.name.charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(contact);
  }
  return [...groups.entries()];
}
