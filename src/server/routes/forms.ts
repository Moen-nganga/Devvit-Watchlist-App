import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { isCurrentUserModerator } from '../core/permissions';

type ExampleFormValues = {
  message?: string;
};

export const forms = new Hono();

forms.post('/example-submit', async (c) => {
  // This form is mod-only per devvit.json ("forUserType": "moderator").
  // Re-verify server-side, since the config only controls UI visibility.
  if (!(await isCurrentUserModerator())) {
    return c.json<UiResponse>({ showToast: 'Only moderators can submit this form.' }, 403);
  }

  const { message } = await c.req.json<ExampleFormValues>();
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';

  return c.json<UiResponse>(
    {
      showToast: trimmedMessage
        ? `Form says: ${trimmedMessage}`
        : 'Form submitted with no message',
    },
    200
  );
});