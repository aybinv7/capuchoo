/** A colour from the 256-colour table (0-15 follow the theme) or a 24-bit value. */
export type AnsiColor = { palette: number } | { rgb: readonly [number, number, number] };

export interface AnsiStyle {
  fg: AnsiColor | null;
  bg: AnsiColor | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  inverse: boolean;
}

/** A run of text drawn in one style; `style` is null for the terminal's default. */
export interface AnsiSegment {
  text: string;
  style: AnsiStyle | null;
}

/** How to draw a segment: theme classes for the 16 named colours, inline values for the rest. */
export interface AnsiPresentation {
  class: string;
  style: Record<string, string> | undefined;
}

const PLAIN: AnsiStyle = Object.freeze({
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strike: false,
  inverse: false,
});

const ESC = 0x1b;
const BEL = "\u0007";

const isPlain = (style: AnsiStyle): boolean =>
  style.fg === null &&
  style.bg === null &&
  !style.bold &&
  !style.dim &&
  !style.italic &&
  !style.underline &&
  !style.strike &&
  !style.inverse;

function byte(value: string | undefined): number | null {
  if (value === undefined || !/^\d{1,3}$/.test(value)) return null;
  const number = Number(value);
  return number <= 255 ? number : null;
}

/** `5;n` or `2;r;g;b` after a 38/48, with how many parameters it used. */
function extendedColor(params: readonly string[]): { color: AnsiColor | null; used: number } {
  if (params[0] === "5") {
    const index = byte(params[1]);
    return { color: index === null ? null : { palette: index }, used: 2 };
  }
  if (params[0] === "2") {
    const [r, g, b] = [byte(params[1]), byte(params[2]), byte(params[3])];
    const color = r === null || g === null || b === null ? null : { rgb: [r, g, b] as const };
    return { color, used: 4 };
  }
  return { color: null, used: params.length === 0 ? 0 : 1 };
}

/** `38:2::r:g:b` and `38:2:r:g:b` carry the colour in one colon group; the colour space is skipped. */
function colonColor(group: string): AnsiColor | null {
  const parts = group.split(":").slice(1);
  if (parts[0] === "2" && parts.length >= 5) return extendedColor(["2", ...parts.slice(-3)]).color;
  return extendedColor(parts).color;
}

function applyCode(style: AnsiStyle, code: number): AnsiStyle {
  if (code === 0) return PLAIN;
  if (code >= 30 && code <= 37) return { ...style, fg: { palette: code - 30 } };
  if (code >= 40 && code <= 47) return { ...style, bg: { palette: code - 40 } };
  if (code >= 90 && code <= 97) return { ...style, fg: { palette: code - 90 + 8 } };
  if (code >= 100 && code <= 107) return { ...style, bg: { palette: code - 100 + 8 } };
  switch (code) {
    case 1:
      return { ...style, bold: true };
    case 2:
      return { ...style, dim: true };
    case 3:
      return { ...style, italic: true };
    case 4:
    case 21:
      return { ...style, underline: true };
    case 7:
      return { ...style, inverse: true };
    case 9:
      return { ...style, strike: true };
    case 22:
      return { ...style, bold: false, dim: false };
    case 23:
      return { ...style, italic: false };
    case 24:
      return { ...style, underline: false };
    case 27:
      return { ...style, inverse: false };
    case 29:
      return { ...style, strike: false };
    case 39:
      return { ...style, fg: null };
    case 49:
      return { ...style, bg: null };
    default:
      return style;
  }
}

/** Applies one SGR sequence's parameters (`1;31`, `38;5;208`, `38:2::0:128:255`). */
function applySgr(style: AnsiStyle, params: string): AnsiStyle {
  const groups = params === "" ? ["0"] : params.split(";");
  let next = style;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index] ?? "";
    if (group.includes(":")) {
      const head = group.slice(0, group.indexOf(":"));
      if (head === "38" || head === "48") {
        const color = colonColor(group);
        if (color) next = head === "38" ? { ...next, fg: color } : { ...next, bg: color };
      } else if (head === "4") {
        next = { ...next, underline: !group.endsWith(":0") };
      }
      continue;
    }
    const code = group === "" ? 0 : Number(group);
    if (!Number.isInteger(code)) continue;
    if (code === 38 || code === 48) {
      const { color, used } = extendedColor(groups.slice(index + 1));
      if (color) next = code === 38 ? { ...next, fg: color } : { ...next, bg: color };
      index += used;
      continue;
    }
    next = applyCode(next, code);
  }
  return next;
}

const inRange = (code: number, low: number, high: number) => code >= low && code <= high;

/**
 * Splits a terminal line into styled runs. Only SGR (colour and weight) is honoured; every other
 * escape sequence, OSC payload (hyperlinks included) and control character is dropped, and a bare
 * carriage return keeps only what was written after it, as a terminal would show it. The result is
 * plain data meant to be rendered as text: nothing in it is markup.
 */
export function parseAnsi(input: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  let style = PLAIN;
  let text = "";

  const flush = () => {
    if (!text) return;
    const last = segments[segments.length - 1];
    const own = isPlain(style) ? null : style;
    if (last && last.style === own) last.text += text;
    else segments.push({ text, style: own });
    text = "";
  };

  let index = 0;
  while (index < input.length) {
    const code = input.charCodeAt(index);
    if (code === ESC) {
      const kind = input[index + 1];
      if (kind === "[") {
        let end = index + 2;
        while (end < input.length && inRange(input.charCodeAt(end), 0x30, 0x3f)) end += 1;
        const paramsEnd = end;
        while (end < input.length && inRange(input.charCodeAt(end), 0x20, 0x2f)) end += 1;
        if (end >= input.length) break;
        if (!inRange(input.charCodeAt(end), 0x40, 0x7e)) {
          index = end;
          continue;
        }
        const params = input.slice(index + 2, paramsEnd);
        if (input[end] === "m" && paramsEnd === end && /^[\d;:]*$/.test(params)) {
          flush();
          style = applySgr(style, params);
        }
        index = end + 1;
        continue;
      }
      if (kind === "]") {
        let end = index + 2;
        while (end < input.length) {
          if (input[end] === BEL) {
            end += 1;
            break;
          }
          if (input.charCodeAt(end) === ESC && input[end + 1] === "\\") {
            end += 2;
            break;
          }
          end += 1;
        }
        index = end;
        continue;
      }
      index += kind === undefined ? 1 : 2;
      continue;
    }
    if (code === 0x0d) {
      if (index + 1 < input.length) {
        text = "";
        segments.length = 0;
      }
      index += 1;
      continue;
    }
    if ((code < 0x20 && code !== 0x09) || inRange(code, 0x7f, 0x9f)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < input.length) {
      const next = input.charCodeAt(end);
      if (
        next === ESC ||
        next === 0x0d ||
        (next < 0x20 && next !== 0x09) ||
        inRange(next, 0x7f, 0x9f)
      )
        break;
      end += 1;
    }
    text += input.slice(index, end);
    index = end;
  }
  flush();
  return segments;
}

/** The text of a terminal line without any styling or control sequence. */
export function stripAnsi(input: string): string {
  let text = "";
  for (const segment of parseAnsi(input)) text += segment.text;
  return text;
}

function cubeLevel(value: number): number {
  return value === 0 ? 0 : 55 + value * 40;
}

/** The xterm value of a 256-colour index above the 16 named ones. */
export function paletteRgb(index: number): readonly [number, number, number] {
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10;
    return [gray, gray, gray];
  }
  const cube = index - 16;
  return [
    cubeLevel(Math.floor(cube / 36)),
    cubeLevel(Math.floor(cube / 6) % 6),
    cubeLevel(cube % 6),
  ];
}

function colorValue(color: AnsiColor): string | null {
  const rgb = "rgb" in color ? color.rgb : color.palette >= 16 ? paletteRgb(color.palette) : null;
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => Math.min(255, Math.max(0, Math.round(channel))));
  return `rgb(${r} ${g} ${b})`;
}

const namedIndex = (color: AnsiColor | null): number | null =>
  color && "palette" in color && color.palette < 16 ? color.palette : null;

/**
 * Classes and inline values for one segment's style. Named colours become `ansi-fg-N` /
 * `ansi-bg-N` classes so the theme decides them; every inline value is built from validated
 * numbers, never from the log's text.
 */
export function ansiPresentation(style: AnsiStyle | null): AnsiPresentation {
  if (!style) return { class: "", style: undefined };
  const fg = style.inverse ? style.bg : style.fg;
  const bg = style.inverse ? style.fg : style.bg;
  const classes: string[] = [];
  const inline: Record<string, string> = {};

  const fgIndex = namedIndex(fg);
  if (fgIndex !== null) classes.push(`ansi-fg-${fgIndex}`);
  else if (fg) inline.color = colorValue(fg) ?? "";
  else if (style.inverse) classes.push("ansi-fg-inverse");

  const bgIndex = namedIndex(bg);
  if (bgIndex !== null) classes.push(`ansi-bg-${bgIndex}`);
  else if (bg) inline.backgroundColor = colorValue(bg) ?? "";
  else if (style.inverse) classes.push("ansi-bg-inverse");

  if (style.bold) classes.push("font-semibold");
  if (style.dim) classes.push("opacity-70");
  if (style.italic) classes.push("italic");
  const decoration = [style.underline && "underline", style.strike && "line-through"].filter(
    Boolean,
  );
  if (decoration.length) inline.textDecorationLine = decoration.join(" ");

  return {
    class: classes.join(" "),
    style: Object.keys(inline).length ? inline : undefined,
  };
}
