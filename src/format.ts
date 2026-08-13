/** Pads `value` on the right and truncates to exactly `length` characters. */
export function padRight(value: string, length: number, char = " "): string {
  return (value + char.repeat(Math.max(0, length - value.length))).slice(0, length);
}

/** Pads `value` on the left and truncates to exactly `length` characters. */
export function padLeft(value: string, length: number, char = "0"): string {
  return (char.repeat(Math.max(0, length - value.length)) + value).slice(-length);
}

/** Formats a monetary amount with exactly two decimal places, e.g. "10.50". */
export function money2(amount: number): string {
  return amount.toFixed(2);
}
