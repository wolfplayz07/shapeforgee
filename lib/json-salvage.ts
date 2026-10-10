/**
 * Recover the longest valid JSON prefix from a model reply that was cut off by max_tokens.
 * Strategy: one pass records the open-bracket stack after every character; then, walking backwards
 * from the end over plausible value endings, close the open brackets and let JSON.parse decide.
 * Pure and dependency-free so it can run inside the Worker.
 */
export interface SalvageResult {
  value: unknown;
  repaired: boolean;
  droppedChars: number;
}

const VALUE_END = /[}\]"0-9el]/; // }, ], end of string, digit, true/false (e), null (l)
const MAX_ATTEMPTS = 160;

function stripWrapper(text: string): string {
  let body = text.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (fenced) body = fenced[1].trim();
  const start = body.indexOf("{");
  return start >= 0 ? body.slice(start) : "";
}

export function salvageTruncatedJson(text: string): SalvageResult | null {
  const body = stripWrapper(text);
  if (!body) return null;
  try {
    return { value: JSON.parse(body), repaired: false, droppedChars: 0 };
  } catch {
    // fall through to repair
  }

  const stacks: string[] = new Array(body.length);
  const inStringAfter: boolean[] = new Array(body.length);
  let stack = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      stack += char;
    } else if (char === "}" || char === "]") {
      stack = stack.slice(0, -1);
    }
    stacks[index] = stack;
    inStringAfter[index] = inString;
  }

  let attempts = 0;
  for (let index = body.length - 1; index >= 0 && attempts < MAX_ATTEMPTS; index -= 1) {
    if (inStringAfter[index] || !VALUE_END.test(body[index])) continue;
    attempts += 1;
    const closers = [...stacks[index]].reverse().map((open) => (open === "{" ? "}" : "]")).join("");
    const candidate = body.slice(0, index + 1) + closers;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object") {
        return { value, repaired: true, droppedChars: body.length - index - 1 };
      }
    } catch {
      // try an earlier cut point
    }
  }
  return null;
}
