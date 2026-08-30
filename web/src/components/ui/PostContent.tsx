import Link from 'next/link';
import { Fragment } from 'react';

interface PostContentProps {
  content: string;
  className?: string;
  /** Max lines before "Show more" is applied (0 = unlimited, handled by parent) */
  clamp?: boolean;
}

// The canonical content tokeniser. Exported so anything that needs to agree
// with what BECOMES a link -- notably the composer's live hashtag highlight --
// reuses this exact pattern instead of keeping a second copy that can drift.
// Split form keeps the delimiters; test form matches a single token.
export const CONTENT_TOKEN_RE = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]{2,30})/g;
export const HASHTAG_RE = /^#[a-zA-Z0-9_]+$/;

/**
 * Renders post content with clickable #hashtag and @mention links.
 * Splits on #word and @word tokens while keeping the delimiter in the array.
 */
export function PostContent({ content, className }: PostContentProps) {
  // Split by hashtag OR mention pattern while keeping the delimiter in the array
  const parts = content.split(CONTENT_TOKEN_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (HASHTAG_RE.test(part)) {
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
