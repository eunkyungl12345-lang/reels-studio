export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const apiKey = (process.env.MANUS_API_KEY || '').replace(/\s+/g, '');
  const { action, prompt, taskId } = await req.json();

  try {
    if (action === 'status') {
      // 태스크 상태 확인
      const statusRes = await fetch(`https://api.manus.im/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!statusRes.ok) {
        return new Response(JSON.stringify({ status: 'polling', error: statusRes.status }), { status: 200 });
      }
      const data = await statusRes.json();
      const status = data.status || 'unknown';
      const text = data.output || data.result || data.content || '';
      return new Response(JSON.stringify({ status, text: typeof text === 'string' ? text : JSON.stringify(text) }), { status: 200 });
    }

    // 태스크 생성
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
    }

    const createRes = await fetch('https://api.manus.im/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message: prompt }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || err.message || `Manus ${createRes.status}` }), { status: createRes.status });
    }

    const task = await createRes.json();
    const id = task.task_id || task.id;
    return new Response(JSON.stringify({ taskId: id, status: 'created' }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || '마누스 API 오류' }), { status: 500 });
  }
}
