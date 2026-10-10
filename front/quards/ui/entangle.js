// Entrelazamiento en la mano: las cartas de un mismo grupo se renderizan juntas
// (contiguas) y se enlazan con un marco, para que no haya líneas encima de las caras.
//
// Un grupo con 2+ cartas sin colapsar está entrelazado; un grupo de 1 carta es solo
// una superposición (no se marca visualmente).

export function entangledGroupOf(state, id, hand) {
  const card = state.cards[id];
  if (!card || !card.group) return null;
  const group = state.groups[card.group];
  if (!group || group.collapsed || card.face) return null;
  // Solo cuenta como entrelazado visible si hay 2+ cartas del grupo en esta mano:
  // un grupo puede estar repartido (la otra carta en la IA/mazo) y entonces no hay par que mostrar.
  const inHand = hand ? group.cards.filter(x => hand.includes(x)).length : group.cards.length;
  return inHand >= 2 ? group : null;
}

// Reordena la mano para que las cartas de un mismo grupo queden contiguas,
// preservando el orden relativo del resto.
export function orderHand(state, hand) {
  const ordered = [];
  const placed = new Set();
  for (const id of hand) {
    const group = entangledGroupOf(state, id, hand);
    if (!group) { ordered.push(id); continue; }
    if (placed.has(group.id)) continue;
    placed.add(group.id);
    for (const other of hand) {
      if (entangledGroupOf(state, other, hand)?.id === group.id) ordered.push(other);
    }
  }
  return ordered;
}
