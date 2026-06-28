import { DateTime } from "luxon";
import type { RecurrenceState, RecurrencePreset, RruleFreq, EndCondition } from "@/types/form";

const WEEKDAYS = [
  { key: "MO", label: "M" },
  { key: "TU", label: "T" },
  { key: "WE", label: "W" },
  { key: "TH", label: "T" },
  { key: "FR", label: "F" },
  { key: "SA", label: "S" },
  { key: "SU", label: "S" },
];

interface Props {
  value: RecurrenceState;
  startDate: string;
  onChange: (next: RecurrenceState) => void;
}

function upd(state: RecurrenceState, patch: Partial<RecurrenceState>): RecurrenceState {
  return { ...state, ...patch };
}

export function RecurrenceSelector({ value, startDate, onChange }: Props) {
  const { preset } = value;

  // Human-readable label for the weekly preset option
  const weeklyLabel = startDate
    ? `Every ${DateTime.fromISO(startDate).toFormat("cccc")}`
    : "Every week";

  const presetOptions: { key: RecurrencePreset; label: string }[] = [
    { key: "none",    label: "Does not repeat" },
    { key: "daily",   label: "Every day" },
    { key: "weekly",  label: weeklyLabel },
    { key: "monthly", label: "Every month" },
    { key: "custom",  label: "Custom…" },
  ];

  const handlePresetChange = (p: RecurrencePreset) => {
    onChange(upd(value, { preset: p }));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Preset dropdown */}
      <select
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value as RecurrencePreset)}
        className="w-full text-sm border border-gcal-border rounded-md px-3 py-2 text-gcal-text-primary bg-white focus:outline-none focus:border-gcal-blue"
      >
        {presetOptions.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Custom builder */}
      {preset === "custom" && (
        <div className="flex flex-col gap-3 pl-2 border-l-2 border-gcal-border">
          {/* Freq + Interval */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gcal-text-secondary">Repeat every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={value.interval}
              onChange={(e) =>
                onChange(upd(value, { interval: Math.max(1, parseInt(e.target.value) || 1) }))
              }
              className="w-14 border border-gcal-border rounded-md px-2 py-1 text-center focus:outline-none focus:border-gcal-blue"
            />
            <select
              value={value.freq}
              onChange={(e) => onChange(upd(value, { freq: e.target.value as RruleFreq }))}
              className="border border-gcal-border rounded-md px-2 py-1 focus:outline-none focus:border-gcal-blue"
            >
              <option value="DAILY">day{value.interval > 1 ? "s" : ""}</option>
              <option value="WEEKLY">week{value.interval > 1 ? "s" : ""}</option>
              <option value="MONTHLY">month{value.interval > 1 ? "s" : ""}</option>
            </select>
          </div>

          {/* By-weekday (only for WEEKLY) */}
          {value.freq === "WEEKLY" && (
            <div>
              <p className="text-xs text-gcal-text-secondary mb-1.5">Repeat on</p>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((d) => {
                  const selected = value.byweekday.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? value.byweekday.filter((x) => x !== d.key)
                          : [...value.byweekday, d.key];
                        onChange(upd(value, { byweekday: next }));
                      }}
                      className={[
                        "w-8 h-8 rounded-full text-xs font-medium transition-colors",
                        selected
                          ? "bg-gcal-blue text-white"
                          : "border border-gcal-border text-gcal-text-secondary hover:bg-gray-100",
                      ].join(" ")}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <p className="text-xs text-gcal-text-secondary mb-1.5">Ends</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { key: "never", label: "Never" },
                  { key: "onDate", label: "On date" },
                  { key: "afterN", label: "After" },
                ] as { key: EndCondition; label: string }[]
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="endCondition"
                    value={key}
                    checked={value.endCondition === key}
                    onChange={() => onChange(upd(value, { endCondition: key }))}
                    className="accent-gcal-blue"
                  />
                  <span className="text-gcal-text-primary">{label}</span>

                  {key === "onDate" && value.endCondition === "onDate" && (
                    <input
                      type="date"
                      value={value.untilDate}
                      min={startDate}
                      onChange={(e) => onChange(upd(value, { untilDate: e.target.value }))}
                      className="ml-1 border border-gcal-border rounded-md px-2 py-0.5 text-sm focus:outline-none focus:border-gcal-blue"
                    />
                  )}

                  {key === "afterN" && value.endCondition === "afterN" && (
                    <div className="flex items-center gap-1 ml-1">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={value.count}
                        onChange={(e) =>
                          onChange(upd(value, { count: Math.max(1, parseInt(e.target.value) || 1) }))
                        }
                        className="w-16 border border-gcal-border rounded-md px-2 py-0.5 text-sm text-center focus:outline-none focus:border-gcal-blue"
                      />
                      <span className="text-gcal-text-secondary text-sm">occurrences</span>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
