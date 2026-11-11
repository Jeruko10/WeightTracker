// Features can't import each other, so the shell plugs the bodyweight provider in (see main.js).
let factory = () => () => null;

export function setBodyweightProvider(fn) {
  factory = fn;
}

// Built once per chart, so the weigh-in series isn't rebuilt for every log.
export function bodyweightLookup() {
  return factory();
}
