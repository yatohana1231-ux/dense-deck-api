export interface Rng {
  random(): number;
}

export const defaultRng: Rng = {
  random: () => Math.random(),
};
