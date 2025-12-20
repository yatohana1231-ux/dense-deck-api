export type Mode = "dense" | "superDense";

export type DealInput = {
  seatCount: number;
  playerOrder: number[];
  boardReserved: string[]; // "As" 等
  mode: Mode;
};

export type DealResult = {
  handId: string;
  mode: Mode;
  seatCount: number;
  playerOrder: number[];
  hands: string[][]; // hands[seat] = ["As","Kd"]
};

