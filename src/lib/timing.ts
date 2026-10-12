/**
 * Step timings for a request, sent as a Server-Timing header so they show up in
 * the browser's devtools (Network → the request → Timing).
 */
export function serverTimer() {
  const steps: [string, number][] = [];
  let last = performance.now();
  return {
    /** Records the time since the previous mark under `name`. */
    mark(name: string) {
      const now = performance.now();
      steps.push([name, now - last]);
      last = now;
    },
    header() {
      return steps.map(([name, ms]) => `${name};dur=${ms.toFixed(0)}`).join(", ");
    },
  };
}

export type ServerTimer = ReturnType<typeof serverTimer>;
