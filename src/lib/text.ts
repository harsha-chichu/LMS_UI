const MAX_PARAGRAPH_CHARS = 300;
const MAX_PARAGRAPH_SENTENCES = 3;

/**
 * Break a long answer into short paragraphs for reading. Text that already has
 * line breaks keeps them; an unbroken block is split at sentence ends into
 * paragraphs of a few sentences each.
 */
export function toParagraphs(text: string): string[] {
  const blocks = text
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.flatMap((block) => {
    if (block.length <= MAX_PARAGRAPH_CHARS) return [block];
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
    const out: string[] = [];
    let current: string[] = [];
    let length = 0;
    for (const sentence of sentences) {
      if (current.length && (current.length >= MAX_PARAGRAPH_SENTENCES || length + sentence.length > MAX_PARAGRAPH_CHARS)) {
        out.push(current.join(" "));
        current = [];
        length = 0;
      }
      current.push(sentence);
      length += sentence.length + 1;
    }
    if (current.length) out.push(current.join(" "));
    return out;
  });
}
