import Link from 'next/link';
import { Fragment } from 'react';

interface PostContentProps {
  content: string;
  className?: string;
  /** Max lines before "Show more" is applied (0 = unlimited, handled by parent) */
  clamp?: boolean;
}

/**
 * Renders post content with clickable #hashtag and @mention links.
 * Splits on #word and @word tokens while keeping the delimiter in the array.
 */
export function PostContent({ content, className }: PostContentProps) {
  // Split by hashtag OR mention pattern while keeping the delimiter in the array
  const parts = content.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]{2,30})/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^#[a-zA-Z0-9_]+$/.test(part)) {
          const tag = part.slice(1).toLowerCase();
          return (
            <Link
              key={i}
              href={`/hashtag/${tag}`}
              onClick={e => e.stopPropagation()}
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
            >
              {part}
            </Link>
          );
        }
        if (/^@[a-zA-Z0-9_]{2,30}$/.test(part)) {
          const username = part.slice(1);
          return (
            <Link
              key={i}
              href={`/u/${username}`}
              onClick={e => e.stopPropagation()}
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
            >
              {part}
            </Link>
          );
        }
        // Preserve newlines in plain text segments
        return (
          <Fragment key={i}>
            {part.split('\n').map((line, li, arr) => (
              <Fragment key={li}>
                {line}
                {li < arr.length - 1 && <br />}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </span>
  );
}
