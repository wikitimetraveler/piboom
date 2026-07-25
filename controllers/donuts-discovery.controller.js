/**
 * Glazed donut discovery — OpenAI Vision identify
 * Development work by David Lane
 */
import { Router } from 'express';
import OpenAI from 'openai';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';

const router = Router();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const SYSTEM = `You are Pip, a playful bakery guide for Glazed (a fan tribute to Savy Donuts & Smoothies on Harbor).
Identify doughnuts / donuts (and close cousins like fritters, cronuts, berliners) from a photo.
Reply in short markdown with:
- **Likely name** (common bakery name)
- **Style** (yeast ring, cake, filled, fritter, cruller, etc.)
- **Visual cues** you used
- **Confidence** (high / medium / low)
- **Fun history nibble** (1–2 sentences — origin lore, not a recipe)
If it is not a donut, say so kindly and guess what it might be.
Never invent a full recipe or step-by-step instructions.`;

router.post('/vision-id', async (req, res) => {
  try {
    const { imageData, prompt: userPrompt } = req.body || {};

    if (!openai) {
      return res.status(503).json({ success: false, error: 'OpenAI not configured' });
    }
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return res.status(400).json({ success: false, error: 'Image data URL is required' });
    }

    const response = await openai.chat.completions.create({
      model: resolveOpenAiVisionModel('DONUT_VISION_MODEL'),
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt || 'Identify this donut from the photo. History vibes welcome — no recipes.'
            },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      max_tokens: 400,
      temperature: 0.25
    });

    const result = response.choices?.[0]?.message?.content || 'No response';
    res.json({ success: true, result });
  } catch (error) {
    console.error('Donut vision error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to identify donut',
      message: error.message
    });
  }
});

export default router;
