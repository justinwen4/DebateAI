"use client";

export const CATEGORIES = ["Theory", "Philosophy", "Kritik"] as const;
export type Category = (typeof CATEGORIES)[number];

interface CategorySelectorProps {
  value: Category;
  onChange: (category: Category) => void;
}

export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <div className="flex gap-1 bg-surface rounded-lg p-0.5 border border-border">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            value === cat
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
