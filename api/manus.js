export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const apiKey = (process.env.MANUS_API_KEY || '').replace(/\s+/g, '');
  const { action, prompt, taskId } = await req.json();

  // 공통 헤더
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'x-manus-api-key': apiKey,
    'API_KEY': apiKey,
  };

  try {
    if (action === 'status') {
      // 태스크 상태 확인 — v1과 v2 둘 다 시도
      let data = null;
      for (const url of [
        `https://api.manus.ai/v1/tasks/${taskId}`,
        `https://api.manus.ai/v2/task.get`,
        `https://open.manus.im/api/v1/tasks/${taskId}`,
      ]) {
        try {
          const r = await fetch(url.includes('v2') ? url : url, {
            method: url.includes('v2') ? 'POST' : 'GET',
            headers,
            ...(url.includes('v2') ? { body: JSON.stringify({ task_id: taskId }) } : {}),
          });
          if (r.ok) { data = await r.json(); break; }
        } catch(e) {}
      }
      if (!data) return new Response(JSON.stringify({ status: 'polling' }), { status: 200 });
      const status = data.status || 'unknown';
      const text = data.output || data.result || data.content || data.answer || '';
      return new Response(JSON.stringify({ status, text: typeof text === 'string' ? text : JSON.stringify(text) }), { status: 200 });
    }

    // 태스크 생성 — 여러 엔드포인트 시도
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
    }

    let task = null;
    let lastError = '';

    // 시도 1: v1
    try {
      const r = await fetch('https://api.manus.ai/v1/tasks', {
        method: 'POST', headers,
        body: JSON.stringify({ message: prompt }),
      });
      if (r.ok) task = await r.json();
      else lastError = `v1: ${r.status} ${await r.text().catch(()=>'')}`;
    } catch(e) { lastError = `v1: ${e.message}`; }

    // 시도 2: v2
    if (!task) {
      try {
        const r = await fetch('https://api.manus.ai/v2/task.create', {
          method: 'POST', headers,
          body: JSON.stringify({ message: { text: prompt } }),
        });
        if (r.ok) task = await r.json();
        else lastError += ` | v2: ${r.status} ${await r.text().catch(()=>'')}`;
      } catch(e) { lastError += ` | v2: ${e.message}`; }
    }

    // 시도 3: open.manus.im
    if (!task) {
      try {
        const r = await fetch('https://open.manus.im/api/v1/tasks', {
          method: 'POST', headers,
          body: JSON.stringify({ message: prompt }),
        });
        if (r.ok) task = await r.json();
        else lastError += ` | open: ${r.status} ${await r.text().catch(()=>'')}`;
      } catch(e) { lastError += ` | open: ${e.message}`; }
    }

    if (!task) {
      return new Response(JSON.stringify({ error: `마누스 API 연결 실패: ${lastError}` }), { status: 502 });
    }

    const id = task.task_id || task.id;
    return new Response(JSON.stringify({ taskId: id, status: 'created', raw: task }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || '마누스 API 오류' }), { status: 500 });
  }
}
