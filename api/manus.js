export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const apiKey = (process.env.MANUS_API_KEY || '').replace(/\s+/g, '');
  const { prompt } = await req.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
  }

  try {
    // 마누스 태스크 생성
    const createRes = await fetch('https://api.manus.im/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        message: prompt,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || err.message || `Manus API ${createRes.status}` }), { status: createRes.status });
    }

    const task = await createRes.json();
    const taskId = task.task_id || task.id;

    if (!taskId) {
      return new Response(JSON.stringify({ error: '태스크 생성 실패', detail: task }), { status: 500 });
    }

    // 태스크 완료 대기 (폴링, 최대 120초)
    let result = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const statusRes = await fetch(`https://api.manus.im/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();

      if (statusData.status === 'completed' || statusData.status === 'done') {
        result = statusData.output || statusData.result || statusData.content || JSON.stringify(statusData);
        break;
      }
      if (statusData.status === 'failed' || statusData.status === 'error') {
        return new Response(JSON.stringify({ error: '마누스 태스크 실패', detail: statusData }), { status: 500 });
      }
    }

    if (!result) {
      return new Response(JSON.stringify({ error: '마누스 응답 시간 초과 (120초)', taskId }), { status: 504 });
    }

    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return new Response(JSON.stringify({ text, taskId }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || '마누스 API 호출 실패' }), { status: 500 });
  }
}
