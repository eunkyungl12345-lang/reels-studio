export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const apiKey = (process.env.CLAUDE_API_KEY || '').replace(/\s+/g, '');
  const { prompt, maxTokens } = await req.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens || 4500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || `API ${res.status}` }), { status: res.status });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return new Response(JSON.stringify({ text }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'API 호출 실패' }), { status: 500 });
  }
}
