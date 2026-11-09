import type { ReactNode } from 'react';

// Returns React nodes rather than HTML so user text is always escaped
export function linkify(text: string): ReactNode[] {
  // split() with a capturing group puts the matched URLs at odd indices
  return text.split(/(https?:\/\/\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    )
  );
}
