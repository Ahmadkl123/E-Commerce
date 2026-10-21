// The backend has no product images, so each product gets a generated
// gradient tile with an icon picked from keywords in its name.

const ICONS = [
  [/headphone|earbud|headset/i, '🎧'],
  [/keyboard/i, '⌨️'],
  [/mouse/i, '🖱️'],
  [/monitor|display|screen/i, '🖥️'],
  [/hub|adapter|cable|usb/i, '🔌'],
  [/watch|fitness/i, '⌚'],
  [/ssd|drive|storage/i, '💾'],
  [/webcam|camera/i, '📷'],
  [/stand|riser/i, '💻'],
  [/microphone|mic/i, '🎙️'],
  [/phone/i, '📱'],
  [/speaker/i, '🔊'],
  [/game|controller/i, '🎮'],
];

const PALETTES = [
  ['#7c5cff', '#22d3ee'],
  ['#f472b6', '#8b5cf6'],
  ['#22d3ee', '#34d399'],
  ['#f59e0b', '#ef4444'],
  ['#6366f1', '#ec4899'],
  ['#10b981', '#3b82f6'],
];

export function productIcon(name = '') {
  return ICONS.find(([re]) => re.test(name))?.[1] ?? '📦';
}

export default function ProductVisual({ product, size = 'md' }) {
  const [from, to] = PALETTES[(product?.id ?? 0) % PALETTES.length];
  return (
    <div
      className={`product-visual product-visual-${size}`}
      style={{ '--from': from, '--to': to }}
      aria-hidden="true"
    >
      <span className="product-visual-icon">{productIcon(product?.name)}</span>
    </div>
  );
}
