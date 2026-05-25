/**
 * Development work by David Lane
 */
import express from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const router = express.Router();

const openai = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY?.trim(),
  modelName: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000
});

const LOCAL_EXPERT_SYSTEM_PROMPT = `You are a friendly Local Expert AI assistant. You help users discover and enjoy their favorite local spots:

**Categories you know well:**
- **Thrift shops** - vintage finds, best days to go, what to look for
- **Taco trucks** - best items, hours, locations, food tips
- **Gardens** - community gardens, botanical gardens, best seasons, plants
- **Bike trails** - difficulty, distance, scenery, parking
- **Fishing spots** - bank fishing, pier, best times, species
- **Kayak spots** - launch points, water conditions, parking, safety
- **Concert venues** - local venues, genres, tips for shows
- **Miscellaneous** - parks, cafés, viewpoints, landmarks, or anything the user saved without a specific category; lean on their Notes field when helpful

**Your personality:**
- Warm, knowledgeable, and enthusiastic about local discovery
- Give practical, actionable advice
- Suggest related spots or categories when relevant
- Use casual but helpful language

**What you can help with:**
- Recommendations for thrift shops, taco trucks, gardens, bike trails, fishing, kayak, concert venues, or miscellaneous local spots
- Tips for getting the most out of each type of spot
- Best times to visit, what to bring, what to expect
- General questions about exploring local areas

Be concise but helpful. If the user shares their spots list, you can reference it to give personalized suggestions.`;

router.post('/chat', async (req, res) => {
  try {
    const { message, context = [], spotsContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let spotsInfo = '';
    if (spotsContext && Array.isArray(spotsContext) && spotsContext.length > 0) {
      spotsInfo = '\n\n**User\'s saved spots (for context):**\n';
      spotsContext.slice(0, 15).forEach((s, i) => {
        spotsInfo += `${i + 1}. ${s.name} (${s.category})${s.address ? ` - ${s.address}` : ''}\n`;
      });
    }

    const systemContent = LOCAL_EXPERT_SYSTEM_PROMPT + spotsInfo;
    const messages = [
      new SystemMessage(systemContent),
      ...context.slice(-6).map((msg) => new HumanMessage(msg)),
      new HumanMessage(message)
    ];

    const response = await openai.invoke(messages);
    const aiMessage = response.content;

    res.json({
      message: aiMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Local spots AI chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error.message
    });
  }
});

export default router;
