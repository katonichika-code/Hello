interface PageDotsProps {
  count: number;
  active: number;
  onSelect: (index: number) => void;
}

export function PageDots({ count, active, onSelect }: PageDotsProps) {
  return (
    <div className="page-dots">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          className={`dot ${i === active ? 'active' : ''}`}
          onClick={() => onSelect(i)}
          aria-label={`Page ${i + 1}`}
        />
      ))}
    </div>
  );
}
