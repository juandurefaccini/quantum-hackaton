// Draws animated lines between entangled cards (same groupId) in a player's hand.
// The overlay SVG is sized to the app and repositioned on every render.
export function sizeLayer(svg, root) {
  const rect = root.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  svg.style.width = `${rect.width}px`;
  svg.style.height = `${rect.height}px`;
  svg.style.left = `${rect.left}px`;
  svg.style.top = `${rect.top}px`;
}

// groups: Map<groupId, HTMLElement[]>
export function drawEntangleLines(svg, groups, root) {
  const rect = root.getBoundingClientRect();
  const parts = [];
  for (const [id, els] of groups) {
    const pts = els.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
    });
    for (let i = 0; i < pts.length - 1; i++) {
      parts.push(`<line class="ent-line" x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[i + 1].x}" y2="${pts[i + 1].y}" />`);
    }
    for (const p of pts) parts.push(`<circle class="ent-node" cx="${p.x}" cy="${p.y}" r="5" />`);
  }
  svg.innerHTML = parts.join('');
}
