/** Breaks a text into lines inside a width. A word too long for a line is split rather than left to overflow. */
export function wrapLines(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let row = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const joined = row ? `${row} ${word}` : word;
    if (measure(joined) <= width) {
      row = joined;
      continue;
    }
    if (row) lines.push(row);
    row = '';
    let rest = word;
    while (measure(rest) > width && rest.length > 1) {
      let take = rest.length - 1;
      while (take > 1 && measure(rest.slice(0, take)) > width) take--;
      lines.push(rest.slice(0, take));
      rest = rest.slice(take);
    }
    row = rest;
  }
  if (row) lines.push(row);
  return lines;
}
