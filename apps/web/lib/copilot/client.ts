import { copilotResponseSchema, type CopilotResponse } from './schema';

export type CopilotApiRequest = {
  case_id: string;
  message: string;
  session_id?: string;
  template?: 'summarize_case' | 'draft_response' | 'extract_timeline' | 'hearing_plan';
  options?: {
    disable_answer_cache?: boolean;
  };
};

export async function sendCopilotMessage(payload: CopilotApiRequest): Promise<{
  data: CopilotResponse;
  sessionId: string | null;
  requestId: string | null;
}> {
  const response = await fetch('/api/copilot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text().catch(() => '');
  const parsedBody = parseJsonBody(rawBody);
  const validated = copilotResponseSchema.safeParse(parsedBody);

  if (!response.ok) {
    const fallbackMessage =
      (validated.success && validated.data.answer_markdown) ||
      getApiErrorMessage(parsedBody) ||
      `تعذر إكمال طلب المساعد القانوني (HTTP ${response.status}).`;
    throw Object.assign(new Error(fallbackMessage), {
      status: response.status,
      payload: validated.success ? validated.data : parsedBody,
    });
  }

  if (!validated.success) {
    throw Object.assign(new Error('وصل رد غير متوقع من الخادم. حاول مرة أخرى.'), {
      status: response.status,
      payload: parsedBody,
    });
  }

  return {
    data: validated.data,
    sessionId: response.headers.get('x-copilot-session-id'),
    requestId: response.headers.get('x-copilot-request-id'),
  };
}

function parseJsonBody(rawBody: string): unknown | null {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const answerMarkdown = (payload as { answer_markdown?: unknown }).answer_markdown;
  if (typeof answerMarkdown === 'string' && answerMarkdown.trim().length > 0) {
    return answerMarkdown;
  }
  return null;
}
