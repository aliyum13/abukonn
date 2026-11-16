import { apiFetch } from './api';

// Publishing News from the phone. The backend is the real gate (requireMediaTeam on
// POST /api/news, read fresh from user_roles on every request); this only decides
// whether to SHOW the control and carries the request.

// GET /api/news/permissions: true for exactly the users POST /api/news would accept.
// The app's own user object has no Media Team information (role / is_admin describe the
// admin panel, and an admin without media_team is refused), so it has to be asked.
// Any failure counts as "no": the control stays hidden rather than appearing for someone
// who may not be allowed.
export async function fetchCanPublishNews(): Promise<boolean> {
  try {
    const data = await apiFetch<{ can_publish?: boolean }>('/api/news/permissions');
    return data.can_publish === true;
  } catch {
    return false;
  }
}

export const NEWS_FORBIDDEN_MESSAGE =
  "You don't have permission to publish News. Publishing is limited to the Media Team.";

// Maps a failed publish to a message for the form. 403 is the one worth saying plainly:
// the role can be revoked after the button was shown, and the server's own text is terse.
export function publishErrorMessage(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 403) return NEWS_FORBIDDEN_MESSAGE;
  return err instanceof Error && err.message ? err.message : 'Could not publish. Please try again.';
}

export async function publishNews(input: { title: string; content: string; imageUrl?: string | null }) {
  return apiFetch<{ article: { id: number } }>('/api/news', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    }),
  });
}
