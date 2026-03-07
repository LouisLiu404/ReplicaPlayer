function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculatePulseLevel(data: ArrayLike<number>): number {
  if (data.length === 0) {
    return 0;
  }

  const sampleLength = Math.max(8, Math.floor(data.length * 0.42));
  let weightedEnergy = 0;
  let totalWeight = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    const normalized = data[index] / 255;
    const weight = 1.18 - (index / sampleLength) * 0.48;
    weightedEnergy += normalized * weight;
    totalWeight += weight;
  }

  const average = totalWeight > 0 ? weightedEnergy / totalWeight : 0;
  return clamp((average - 0.06) / 0.48, 0, 1);
}

export function smoothPulse(current: number, target: number, active: boolean): number {
  const eased = active
    ? current + (target - current) * 0.18
    : current * 0.9;

  return eased < 0.003 ? 0 : clamp(eased, 0, 1);
}
