// Where Exercises gets the user's bodyweight from. Features can't import each other, so the shell
// plugs in a provider (see main.js): a factory returning `date → 7-day average kg | null`.
let factory = () => () => null;

export function setBodyweightProvider(fn) {
  factory = fn;
}

/** A lookup built once per chart, so the weigh-in series isn't rebuilt for every log. */
export function bodyweightLookup() {
  return factory();
}
