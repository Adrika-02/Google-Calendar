const COLORS: { id: string; bg: string; label: string }[] = [
  { id: "tomato",    bg: "#D50000", label: "Tomato" },
  { id: "flamingo",  bg: "#E67C73", label: "Flamingo" },
  { id: "tangerine", bg: "#F4511E", label: "Tangerine" },
  { id: "banana",    bg: "#F6BF26", label: "Banana" },
  { id: "sage",      bg: "#33B679", label: "Sage" },
  { id: "basil",     bg: "#0B8043", label: "Basil" },
  { id: "peacock",   bg: "#039BE5", label: "Peacock" },
  { id: "blueberry", bg: "#3F51B5", label: "Blueberry" },
  { id: "lavender",  bg: "#7986CB", label: "Lavender" },
  { id: "grape",     bg: "#8E24AA", label: "Grape" },
  { id: "graphite",  bg: "#616161", label: "Graphite" },
];

interface ColorPickerProps {
  value: string;
  onChange: (colorId: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.label}
          onClick={() => onChange(c.id)}
          className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
          style={{ backgroundColor: c.bg }}
          aria-label={c.label}
          aria-pressed={value === c.id}
        >
          {value === c.id && (
            <span className="flex items-center justify-center w-full h-full">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
