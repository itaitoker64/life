export type Units = 'metric' | 'imperial';

export function kgToDisplay(kg: number, units: Units): number {
  return units === 'metric' ? kg : kg * 2.20462;
}

export function displayToKg(v: number, units: Units): number {
  return units === 'metric' ? v : v / 2.20462;
}

export function weightLabel(units: Units): string {
  return units === 'metric' ? 'ק"ג' : 'lb';
}

export function cmToDisplay(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} ס"מ`;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}'${inch}"`;
}

export function fmtWeight(kg: number, units: Units, digits = 1): string {
  return `${kgToDisplay(kg, units).toFixed(digits)} ${weightLabel(units)}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
