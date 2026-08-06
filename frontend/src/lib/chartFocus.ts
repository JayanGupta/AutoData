type Listener = (id: string) => void;

let listener: Listener | null = null;

export function onChartFocus(cb: Listener): () => void {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
}

export function requestChartFocus(id: string) {
  listener?.(id);
}
