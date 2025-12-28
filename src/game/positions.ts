export function getPositions(btnIndex: number, playerCount: number) {
  const btn = btnIndex % playerCount;
  const bb = (btn + 1) % playerCount;
  const utg = (btn + 2) % playerCount;
  const co = (btn + 3) % playerCount;
  return { btn, bb, utg, co };
}

export function getPreflopOrder(btnIndex: number, playerCount: number): number[] {
  const { utg, co, btn, bb } = getPositions(btnIndex, playerCount);
  return [utg, co, btn, bb];
}

export function getPostflopOrder(btnIndex: number, playerCount: number): number[] {
  const { bb, utg, co, btn } = getPositions(btnIndex, playerCount);
  return [bb, utg, co, btn];
}
