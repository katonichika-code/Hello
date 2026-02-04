interface MonthFilterProps {
  value: string;
  onChange: (month: string) => void;
}

export function MonthFilter({ value, onChange }: MonthFilterProps) {
  // Generate list of months from current month back 12 months
  const months: string[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }

  return (
    <div className="month-filter">
      <label htmlFor="month-select">対象月: </label>
      <select
        id="month-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">すべて</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
