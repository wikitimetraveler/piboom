/**
 * Development work by David Lane
 */
import OpenAI from 'openai';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export async function visionIdentifyBike(req, res) {
  try {
    const { imageData, prompt: userPrompt } = req.body;

    if (!openai) {
      return res.status(503).json({ success: false, error: 'OpenAI not configured' });
    }
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return res.status(400).json({ success: false, error: 'Image data URL is required' });
    }

    const systemPrompt =
      'You are a professional e-bike and bicycle product specialist. Identify bikes from photos and summarize key specs. Provide concise results.';

    const response = await openai.chat.completions.create({
      model: resolveOpenAiVisionModel('BIKE_VISION_MODEL'),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                (userPrompt || 'Identify this bike.') +
                ' Return JSON with: brand, model, size, color, motor, battery, priceEstimate (number, USD), notes.'
            },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      max_tokens: 400,
      temperature: 0.2
    });

    const result = response.choices?.[0]?.message?.content || 'No response';
    let structured = null;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) structured = JSON.parse(jsonMatch[0]);
    } catch (err) {
      structured = null;
    }

    res.json({ success: true, result, structured });
  } catch (error) {
    console.error('❌ Bike vision error:', error);
    res.status(500).json({ success: false, error: 'Failed to identify bike', message: error.message });
  }
}

