const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Rough width of 11px text, enough to size a shields-style badge. */
function textWidth(text: string): number {
  return Math.ceil([...text].reduce((w, c) => w + (c === " " || c === "·" ? 3.5 : /[A-Z0-9°]/.test(c) ? 7.5 : 6.2), 0));
}

/** A shields-style SVG badge: "Ziki weather | <forecast>". */
export function badgeSvg(value: string): string {
  const label = "Ziki weather";
  const lw = textWidth(label) + 30;
  const vw = textWidth(value) + 16;
  const w = lw + vw;
  const safe = escapeXml(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${safe}"><title>${label}: ${safe}</title><clipPath id="r"><rect width="${w}" height="20" rx="4"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#3e4a63"/><rect x="${lw}" width="${vw}" height="20" fill="#1f5fd9"/></g><circle cx="12" cy="10" r="4" fill="#ffc94a"/><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="22" y="14">${label}</text><text x="${lw + 8}" y="14">${safe}</text></g></svg>`;
}
