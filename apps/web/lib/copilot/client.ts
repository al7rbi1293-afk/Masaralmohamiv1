import type { CopilotResponse } from './schema';

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

  const json = (await response.json()) as CopilotResponse;

  if (!response.ok) {
    throw Object.assign(new Error(json.answer_markdown || 'copilot_request_failed'), {
      status: response.status,
      payload: json,
    });
  }

  return {
    data: json,
    sessionId: response.headers.get('x-copilot-session-id'),
    requestId: response.headers.get('x-copilot-request-id'),
  };
}
