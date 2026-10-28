/**
 * toTitleCase - upper-cases the first letter of every word and leaves the rest
 * as typed, so "GTR", "MRK" and "McDonald" stay intact. One trailing space is
 * kept so typing the next word still works. Used on every keystroke.
 */
export const toTitleCase = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\s/, "")
    .replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

export default toTitleCase;
