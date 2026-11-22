"use client";

/**
 * Live transcription over Deepgram's streaming API. Mic audio is converted to
 * 16 kHz 16-bit PCM in an AudioWorklet and streamed over a WebSocket; words
 * come back while the user is still speaking, interim ones refined into final ones.
 */

export interface LiveCallbacks {
  /** Everything confirmed so far, plus the words still being refined. */
  onText(finalText: string, interim: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface LiveEngine {
  /** Flush the last words, close, and resolve with everything heard. */
  stop(): Promise<string>;
  /** Close immediately, discarding anything in flight. */
  abort(): void;
}

export type StartResult = { engine: LiveEngine } | { unavailable: true } | { error: string };

const TARGET_RATE = 16_000;
const OPEN_TIMEOUT_MS = 5000;
const CLOSE_TIMEOUT_MS = 2500;

// Averages input samples down to the target rate and posts ~100 ms Int16 chunks.
const WORKLET = `
class PcmTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / options.processorOptions.rate;
    this.pos = 0; this.acc = 0; this.cnt = 0;
    this.size = Math.round(options.processorOptions.rate / 10);
    this.out = new Int16Array(this.size); this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.cnt++; this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.acc / this.cnt));
        this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.acc = 0; this.cnt = 0;
        if (this.n === this.size) {
          this.port.postMessage(this.out.buffer, [this.out.buffer]);
          this.out = new Int16Array(this.size); this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-tap", PcmTap);
`;

/** True when this browser can capture raw mic audio for streaming. */
export function liveCaptureSupported() {
  return (
    typeof window !== "undefined" &&
    typeof AudioWorkletNode !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/speech/token", { method: "POST", cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

function micError(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "microphone access was blocked — allow it in your browser, or type instead.";
  if (name === "NotFoundError") return "no microphone found — type your answer instead.";
  return "couldn't open the microphone — type your answer instead.";
}

function openSocket(url: string, token: string) {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url, ["bearer", token]);
    ws.binaryType = "arraybuffer";
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("timeout"));
    }, OPEN_TIMEOUT_MS);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("socket error"));
    };
  });
}

/**
 * Must be called straight from a click/tap so the AudioContext may start.
 * `unavailable` means Deepgram isn't set up or reachable: use another engine.
 */
export async function startDeepgram(cb: LiveCallbacks, keyterms: string[] = []): Promise<StartResult> {
  if (!liveCaptureSupported()) return { unavailable: true };

  // Created before any await so it counts as user-initiated (Safari).
  const ctx = new AudioContext();
  let stream: MediaStream | null = null;
  const fail = (r: StartResult): StartResult => {
    stream?.getTracks().forEach((t) => t.stop());
    void ctx.close();
    return r;
  };

  const micPromise = navigator.mediaDevices
    .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    .then((s) => ({ stream: s }), (err: unknown) => ({ error: micError(err) }));
  const [token, mic] = await Promise.all([fetchToken(), micPromise]);
  if ("stream" in mic) stream = mic.stream;
  if (!token) return fail({ unavailable: true });
  if ("error" in mic) return fail({ error: mic.error });

  const rate = Math.min(TARGET_RATE, ctx.sampleRate);
  const params = new URLSearchParams({
    model: "nova-3",
    language: "en",
    interim_results: "true",
    smart_format: "true",
    punctuate: "true",
    endpointing: "300",
    encoding: "linear16",
    sample_rate: String(rate),
    channels: "1",
  });
  for (const term of keyterms) params.append("keyterm", term);

  let ws: WebSocket;
  try {
    ws = await openSocket(`wss://api.deepgram.com/v1/listen?${params}`, token);
  } catch {
    return fail({ unavailable: true });
  }

  let node: AudioWorkletNode;
  let source: MediaStreamAudioSourceNode;
  const workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(workletUrl);
    await ctx.resume();
    source = ctx.createMediaStreamSource(stream!);
    node = new AudioWorkletNode(ctx, "pcm-tap", { processorOptions: { rate } });
  } catch {
    ws.close();
    return fail({ unavailable: true });
  } finally {
    URL.revokeObjectURL(workletUrl);
  }
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
  };
  source.connect(node);
  // Outputs silence; connected so the browser keeps pulling audio through it.
  node.connect(ctx.destination);

  let finalText = "";
  let interim = "";
  let stopping = false;
  let ended = false;
  let onClosed: (() => void) | null = null;
  const heard = () => `${finalText} ${interim}`.replace(/\s+/g, " ").trim();

  const releaseAudio = () => {
    node.port.onmessage = null;
    source.disconnect();
    node.disconnect();
    stream!.getTracks().forEach((t) => t.stop());
    if (ctx.state !== "closed") void ctx.close();
  };
  const end = () => {
    if (ended) return;
    ended = true;
    releaseAudio();
    cb.onEnd();
  };

  ws.onmessage = (e) => {
    if (typeof e.data !== "string") return;
    let msg: {
      type?: string;
      is_final?: boolean;
      channel?: { alternatives?: { transcript?: string }[] };
    };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type !== "Results") return;
    const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
    if (msg.is_final) {
      if (text) finalText += `${text} `;
      interim = "";
    } else {
      interim = text;
    }
    if (!ended) cb.onText(finalText, interim);
  };
  ws.onerror = () => {};
  ws.onclose = () => {
    if (!stopping && !ended) cb.onError("live transcription disconnected — fix the text below, or try again.");
    end();
    onClosed?.();
  };

  return {
    engine: {
      stop() {
        if (ended) return Promise.resolve(heard());
        stopping = true;
        releaseAudio();
        return new Promise<string>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            end();
            resolve(heard());
          };
          const timer = setTimeout(() => {
            ws.close();
            done();
          }, CLOSE_TIMEOUT_MS);
          onClosed = done;
          // Deepgram flushes the remaining results, then closes the socket.
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
          else done();
        });
      },
      abort() {
        stopping = true;
        ended = true;
        releaseAudio();
        ws.close();
        cb.onEnd();
      },
    },
  };
}

const KEYTERM_STOP = new Set(
  "what how why when where which who whom whose explain describe tell walk give can could would should is are do does did the a an in on of for to and or with your you i if it this that between".split(
    " ",
  ),
);

/**
 * Words from the question likely to trip a speech model: proper nouns,
 * camelCase, acronyms and names with digits or symbols (useEffect, OAuth, C++, S3).
 */
export function keytermsFor(text: string) {
  const terms = new Set<string>();
  for (const raw of text.split(/[\s,;:!?()"'`[\]{}]+/)) {
    const word = raw.replace(/^[.\-]+|[.\-]+$/g, "");
    if (word.length < 2 || word.length > 40 || !/[a-z]/i.test(word) || KEYTERM_STOP.has(word.toLowerCase())) continue;
    if (/[A-Z]/.test(word.slice(1)) || /\d|[+#./_]/.test(word) || /^[A-Z][a-z]/.test(word)) terms.add(word);
  }
  return [...terms].slice(0, 40);
}
