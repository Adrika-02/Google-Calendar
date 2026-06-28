export interface ColorDef {
  bg: string;
  text: string;
}

// Mirrors the GCal 11-color palette. colorId strings come from the server.
const PALETTE: Record<string, ColorDef> = {
  tomato:    { bg: "#D50000", text: "#fff" },
  flamingo:  { bg: "#E67C73", text: "#fff" },
  tangerine: { bg: "#F4511E", text: "#fff" },
  banana:    { bg: "#F6BF26", text: "#3c4043" },
  sage:      { bg: "#33B679", text: "#fff" },
  basil:     { bg: "#0B8043", text: "#fff" },
  peacock:   { bg: "#039BE5", text: "#fff" },
  blueberry: { bg: "#3F51B5", text: "#fff" },
  lavender:  { bg: "#7986CB", text: "#fff" },
  grape:     { bg: "#8E24AA", text: "#fff" },
  graphite:  { bg: "#616161", text: "#fff" },
};

const FALLBACK: ColorDef = { bg: "#616161", text: "#fff" };

export function getColor(colorId: string): ColorDef {
  return PALETTE[colorId] ?? FALLBACK;
}
