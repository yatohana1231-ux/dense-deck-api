export const positions = ["BTN", "BB", "UTG", "CO"] as const;

export function getPositions(btnIndex: number, playerCount: number) {
  const bb = (btnIndex + 1) % playerCount;
  const utg = (btnIndex + 2) % playerCount;
  const co = (btnIndex + 3) % playerCount;
  return { btn: btnIndex, bb, utg, co };
}

// プリフロップ: UTG→CO→BTN→BB→UTG
export function getPreflopOrder(btnIndex: number, playerCount: number): number[] {
  const { bb } = getPositions(btnIndex, playerCount);
  const order: number[] = [];
  for (let i = 1; i < playerCount; i++) {
    order.push((bb + i) % playerCount);
  }
  order.push(bb);
  return order;
}

// ポストフロップ: BB→UTG→CO→BTN→BB
export function getPostflopOrder(btnIndex: number, playerCount: number): number[] {
  const { bb } = getPositions(btnIndex, playerCount);
  const order: number[] = [bb];
  for (let i = 1; i < playerCount; i++) {
    order.push((bb + i) % playerCount);
  }
  return order;
}
