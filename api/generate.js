const Anthropic = require('@anthropic-ai/sdk');

const apiKey = (process.env.CLAUDE_API_KEY || '').replace(/\s+/g, '');
const client = new Anthropic({ apiKey });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { prompt, maxTokens } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 4500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content?.[0]?.text || '';
    res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API 호출 실패' });
  }
};
