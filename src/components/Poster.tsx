import { useState } from "react";
import { Film } from "lucide-react";
import { localImage, type LibraryItem } from "../api";
import { titleOf } from "../format";

/** Plakat z cache lub elegancki placeholder z tytułem. */
export function Poster({ item, className = "" }: { item: LibraryItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = localImage(item.details?.posterPath);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={titleOf(item)}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface-2 to-surface p-4 text-center ${className}`}
    >
      <Film className="size-8 text-muted/60" strokeWidth={1.5} />
      <span className="line-clamp-3 text-sm font-medium text-fg/80">{titleOf(item)}</span>
    </div>
  );
}
