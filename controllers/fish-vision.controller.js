import OpenAI from 'openai';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export async function visionIdentify(req, res) {
  try {
    const { imageData, prompt: userPrompt } = req.body;

    if (!openai) {
      return res.status(503).json({ success: false, error: 'OpenAI not configured' });
    }
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return res.status(400).json({ success: false, error: 'Image data URL is required' });
    }

    const systemPrompt =
      'You are Marina, a California fisheries biologist. Identify fish species from the photo (California freshwater and saltwater). Provide likely species, key visual cues (fins, tail shape, markings), habitat context if visible, and a confidence note. If uncertain, list top 2-3 candidates with quick differentiators. Be concise.';

    const response = await openai.chat.completions.create({
      model: resolveOpenAiVisionModel('FISH_VISION_MODEL'),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt || 'Identify this fish from the photo.' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      max_tokens: 350,
      temperature: 0.2
    });

    const result = response.choices?.[0]?.message?.content || 'No response';
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Fish vision error:', error);
    res.status(500).json({ success: false, error: 'Failed to identify fish', message: error.message });
  }
}

