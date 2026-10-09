import { Star } from "lucide-react";
import { formatRating } from "../format";

export function Rating({ value, className = "" }: { value: number | null; className?: string }) {
  if (value == null) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${className}`}>
      <Star className="size-[0.9em] fill-accent text-accent" />
      {formatRating(value)}
    </span>
  );
}
