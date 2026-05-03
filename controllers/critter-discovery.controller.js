import OpenAI from 'openai';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';
import { resolveOpenAiAgentModel } from '../services/openai-agent-model.js';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Identify animal/critter from image using OpenAI Vision API
 */
export async function identifyCritterFromImage(req, res) {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
    }

    console.log('🦎 Analyzing critter image with AI Vision...');

    const response = await openai.chat.completions.create({
      model: resolveOpenAiVisionModel('CRITTER_VISION_MODEL'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a wildlife expert who identifies animals from photos. You know mammals, birds, reptiles, amphibians, insects, and other critters across North America and worldwide.

Analyze this image and identify the animal. Provide:

1. **Animal Name** (Common name and Scientific name)
2. **Confidence Level** (High/Medium/Low)
3. **Key Identifying Features** (coloration, size, markings, etc.)
4. **Habitat** where this animal is commonly found
5. **Fun Facts** (2-3 interesting facts)
6. **Conservation Status** (if applicable)

Be friendly and educational! If you're not certain, say so and suggest possibilities. If it's a common backyard or trail critter, mention that!

Format your response as JSON:
{
  "animalName": "Common Name",
  "scientificName": "Scientific Name",
  "confidence": "High/Medium/Low",
  "features": ["feature1", "feature2", "feature3"],
  "habitat": "Where this animal lives",
  "funFacts": ["fact1", "fact2", "fact3"],
  "conservationStatus": "Status or Not Evaluated",
  "description": "A friendly 2-3 sentence description"
}`
            },
            {
              type: 'image_url',
              image_url: { url: imageData }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const aiResponse = response.choices[0].message.content;
    console.log('✅ AI Vision critter response received');

    let critterData;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        critterData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.log('⚠️ JSON parsing failed, using fallback');
      critterData = {
        animalName: 'Unidentified Critter',
        scientificName: 'Unknown',
        confidence: 'Low',
        features: ['Please try another photo'],
        habitat: 'Unknown',
        funFacts: ['Try taking a clearer photo!'],
        conservationStatus: 'Unknown',
        description: aiResponse.substring(0, 300),
      };
    }

    res.json({ success: true, critter: critterData, rawResponse: aiResponse });
  } catch (error) {
    console.error('❌ Error identifying critter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to identify critter',
      message: error.message,
    });
  }
}

/**
 * Get critter/animal information from AI expert.
 * Optional expert param: 'socal' | 'desert' | 'reptile' - routes to specialized expert.
 */
export async function getCritterInfo(req, res) {
  try {
    const { animalName, expert: expertKey } = req.body;

    if (!animalName) {
      return res.status(400).json({ success: false, error: 'Animal name is required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
    }

    const validExperts = ['socal', 'desert', 'reptile'];
    const expert = validExperts.includes(expertKey) ? expertKey : null;
    const systemPrompt = expert ? EXPERT_PROMPTS[expert] : `You are a friendly wildlife expert who loves helping people learn about animals. You know mammals, birds, reptiles, amphibians, insects, and other critters. Share interesting facts, habitat info, conservation status, and tips for observing wildlife safely. Be enthusiastic and educational!`;
    const assistantNames = { socal: 'SoCal Wildlife Expert', desert: 'Hesperia Desert Expert', reptile: 'Snake, Spider & Reptile Expert' };

    console.log('🦎 Getting critter info for:', animalName, expert ? `(expert: ${expert})` : '');

    const response = await openai.chat.completions.create({
      model: resolveOpenAiAgentModel('CRITTER_CHAT_MODEL'),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Tell me all about the ${animalName}! I want to know:
- What it looks like and key identifying features
- Where it lives (habitat, range)
- Interesting facts and behavior
- Conservation status
- Tips for spotting or observing it safely

Be enthusiastic and educational!`,
        },
      ],
      max_tokens: 800,
      temperature: 0.8,
    });

    const info = response.choices[0].message.content;

    res.json({
      success: true,
      animalName,
      info,
      assistant: expert ? assistantNames[expert] : 'Critter Expert',
      expert: expert || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error getting critter info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get critter information',
      message: error.message,
    });
  }
}

const EXPERT_PROMPTS = {
  socal: `You are a Southern California wildlife expert who knows the animals of coastal sage scrub, chaparral, foothills, and mountain habitats. You're familiar with:
- San Gabriel Mountains, San Bernardino Mountains, San Jacinto Mountains
- LA basin, coastal areas, urban/suburban wildlife
- Mammals: deer, bobcats, coyotes, mountain lions, raccoons, squirrels, opossums
- Birds: scrub jays, hawks, owls, hummingbirds, roadrunners
- Amphibians: tree frogs, toads, salamanders
- Insects: butterflies, beetles, bees
- Reptiles: lizards, gopher snakes, rattlesnakes, alligator lizards

Share local knowledge, habitat tips, and where to spot wildlife. Be enthusiastic and educational about SoCal's diverse ecosystems!`,

  desert: `You are a local expert on wildlife in the Hesperia/Victor Valley High Desert and Mojave Desert. You've lived in or know Hesperia intimately! You know:
- Desert tortoise, chuckwalla, desert iguana, sidewinder, Mojave rattlesnake
- Roadrunner, cactus wren, desert bighorn sheep
- Kangaroo rat, kit fox, coyote, jackrabbit
- Joshua Tree, Mojave Desert, Victor Valley area

Use expressions like "Out here in Hesperia...", "In the High Desert we see...", "Around Victor Valley...". Share local tips, where critters hide, and desert safety. Be enthusiastic about the unique beauty of desert wildlife!`,

  reptile: `You are a snake, spider, and reptile specialist (herpetology and arachnids). You know:
- Snakes: venomous (rattlesnakes, coral snakes) vs harmless (gopher snake, king snake, garter snake) - identification, behavior, safety
- Spiders: black widows, brown recluses, tarantulas, wolf spiders, orb weavers - ID and safety
- Lizards: alligator lizards, skinks, geckos, chuckwallas, iguanas
- Turtles and tortoises

Focus on identification, venomous vs harmless, first-aid awareness, and safe observation. Be educational and emphasize safety without being alarmist. Help people appreciate these often-misunderstood creatures!`
};

/**
 * Chat with a critter expert (SoCal, Desert, or Reptile/Snake/Spider)
 */
export async function chatWithCritterExpert(req, res) {
  try {
    const { message, expert: expertKey } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const validExperts = ['socal', 'desert', 'reptile'];
    const expert = validExperts.includes(expertKey) ? expertKey : 'socal';

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
    }

    const assistantNames = { socal: 'SoCal Wildlife Expert', desert: 'Hesperia Desert Expert', reptile: 'Snake, Spider & Reptile Expert' };
    console.log(`🦎 Asking ${assistantNames[expert]}:`, message.substring(0, 50) + '...');

    const response = await openai.chat.completions.create({
      model: resolveOpenAiAgentModel('CRITTER_CHAT_MODEL'),
      messages: [
        { role: 'system', content: EXPERT_PROMPTS[expert] },
        { role: 'user', content: message }
      ],
      max_tokens: 800,
      temperature: 0.8,
    });

    const aiResponse = response.choices[0].message.content;

    res.json({
      success: true,
      response: aiResponse,
      assistant: assistantNames[expert],
      expert,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in critter expert chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get expert response',
      message: error.message,
    });
  }
}
