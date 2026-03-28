interface MetricTileProps {
  value: string;
  label: string;
  hint: string;
}

export function MetricTile({ value, label, hint }: MetricTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="text-2xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{label}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}
