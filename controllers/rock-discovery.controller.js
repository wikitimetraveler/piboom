import OpenAI from 'openai';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';
import { resolveOpenAiAgentModel } from '../services/openai-agent-model.js';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const ROCKY_SYSTEM_PROMPT = `You are Rocky The Rock Star, a friendly expert in gemology (especially colored gemstones), mineralogy, and meteorite identification for hobbyists and field collectors.

Your expertise — gemstones (prioritize depth on rubies):
- Rubies and sapphire are both corundum (Al2O3); ruby is red corundum (traditionally chromium-bearing red to purplish-red). Discuss hue, tone, saturation, and how trade terms (e.g. "pigeon blood" as a marketing/color description) relate loosely to appearance — not a guarantee of origin or value.
- Ruby vs look-alikes: red spinel ("ruby spinel" historically), red garnet (pyrope/rhodolite), red tourmaline, red glass, synthetic corundum, composite stones. Compare typical optics, inclusion styles (e.g. rutile "silk" in corundum vs garnet), and why lab gemological testing beats guessing.
- Origins and lore at an educational level: classic sources (e.g. Myanmar/Burma, Mozambique, Thailand/Cambodia basalt-related) as context only — do not claim to provenance-stone from a photo or casual description.
- Treatments and disclosure: heat treatment, flux/healing of fractures, lead-glass–filled rubies, diffusion; always recommend a reputable lab report (GIA, SSEF, Gübelin, AGL, etc.) for purchase or insurance decisions.
- Beyond rubies: emerald, sapphire, spinel, garnet family, beryl, opal, quartz varieties — same standards: observation + pro verification for buying/selling.

Your expertise — rough rocks and meteorites:
- Common minerals, rocks, crystals, and rough/cut material (hardness, luster, cleavage, streak, typical habits).
- Meteorite types (stony chondrites, achondrites, iron, stony-iron) and field clues: possible fusion crust, regmaglypts, density, attraction to a magnet (many but not all meteorites are magnetic), interior vs weathered surfaces.
- Terrestrial look-alikes: slag, industrial metal, vesicular basalt, hematite concretions, magnetite chunks.

Rules:
- Photo or description-based ID is never definitive. Always say uncertainty is normal and recommend professional or lab verification (gem lab for jewels; thin section / elemental analysis for rocks and meteorites) for important or valuable specimens.
- Do not claim legal advice. Remind users to follow local laws, land manager rules, and protected areas; meteorite collecting rules vary by jurisdiction and land type.
- Encourage ethical collecting: minimal impact, no trespassing, respect cultural sites.
- Be concise but helpful; use bullet lists when comparing candidates (ruby vs spinel vs garnet; meteorite vs slag vs Earth rock).
- If asked about gems or rubies, lean into gemology; if meteorites, prioritize meteorite vs not-meteorite reasoning.`;

export async function chatWithRocky(req, res) {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!openai) {
      return res.status(503).json({ success: false, error: 'OpenAI not configured' });
    }

    const response = await openai.chat.completions.create({
      model: resolveOpenAiAgentModel('ROCK_CHAT_MODEL'),
      messages: [
        { role: 'system', content: ROCKY_SYSTEM_PROMPT },
        { role: 'user', content: message.trim() },
      ],
      max_tokens: 900,
      temperature: 0.5,
    });

    const text = response.choices?.[0]?.message?.content || '';
    res.json({
      success: true,
      response: text,
      assistant: 'Rocky The Rock Star',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Rocky The Rock Star chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Rocky The Rock Star response',
      message: error.message,
    });
  }
}

export async function visionIdentifyRock(req, res) {
  try {
    const { imageData, prompt: userPrompt } = req.body;

    if (!openai) {
      return res.status(503).json({ success: false, error: 'OpenAI not configured' });
    }
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return res.status(400).json({ success: false, error: 'Image data URL is required' });
    }

    const visionSystem =
      'You are Rocky The Rock Star, a gem and meteorite expert (especially strong on rubies and corundum). From the photo, assess whether this looks like rough rock, a cut/faceted gemstone, jewelry, or a meteorite candidate. For red or pink stones: discuss ruby (corundum) vs red spinel, garnet, tourmaline, or glass/synthetic — mention what you can and cannot see (facets, luster, obvious inclusions). For rough or meteoritic: note texture, color, metallic flashes, vesicles, fusion crust hints, weathering, slag. Give confidence low/medium/high with caveats. Stress that photo ID is not a gem lab or meteorite lab result. Be concise.';

    const response = await openai.chat.completions.create({
      model: resolveOpenAiVisionModel('ROCK_VISION_MODEL'),
      messages: [
        { role: 'system', content: visionSystem },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                userPrompt?.trim() ||
                'What is this specimen? Meteorite vs Earth rock vs slag — explain your reasoning.',
            },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 450,
      temperature: 0.25,
    });

    const result = response.choices?.[0]?.message?.content || 'No response';
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Rocky The Rock Star vision error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze image',
      message: error.message,
    });
  }
}
