import OpenAI from 'openai';

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Identify tree from image using OpenAI Vision API
 */
export async function identifyTreeFromImage(req, res) {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Image data is required' 
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
    }

    console.log('🌲 Analyzing tree image with AI Vision...');

    // Use OpenAI Vision to identify the tree
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are Smokey the Bear, an expert on North American trees! 🐻🌲

Analyze this image and identify the tree species. Provide:

1. **Tree Name** (Common name and Scientific name)
2. **Confidence Level** (High/Medium/Low)
3. **Key Identifying Features** you see (leaves, bark, shape, etc.)
4. **Region** where this tree is commonly found in North America
5. **Fun Facts** (2-3 interesting facts about this tree)
6. **Conservation Status** (if applicable)

Be friendly and educational! If you're not certain, say so and suggest what it might be.

Format your response as JSON:
{
  "treeName": "Common Name",
  "scientificName": "Scientific Name",
  "confidence": "High/Medium/Low",
  "features": ["feature1", "feature2", "feature3"],
  "region": "Geographic region",
  "funFacts": ["fact1", "fact2", "fact3"],
  "conservationStatus": "Status or Not Evaluated",
  "description": "A friendly 2-3 sentence description from Smokey"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const aiResponse = response.choices[0].message.content;
    console.log('✅ AI Vision response received');

    // Try to parse JSON response
    let treeData;
    try {
      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        treeData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // If parsing fails, create structured response from text
      console.log('⚠️ JSON parsing failed, using fallback');
      treeData = {
        treeName: 'Unidentified Tree',
        scientificName: 'Unknown',
        confidence: 'Low',
        features: ['Please try another photo'],
        region: 'Unknown',
        funFacts: ['Try taking a clearer photo of the leaves, bark, or overall tree shape!'],
        conservationStatus: 'Unknown',
        description: aiResponse.substring(0, 300)
      };
    }

    res.json({
      success: true,
      tree: treeData,
      rawResponse: aiResponse
    });

  } catch (error) {
    console.error('❌ Error identifying tree:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to identify tree',
      message: error.message 
    });
  }
}

/**
 * Get tree information from Smokey the Bear AI
 */
export async function getTreeInfo(req, res) {
  try {
    const { treeName } = req.body;
    
    if (!treeName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tree name is required' 
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
    }

    console.log('🌲 Getting tree info from Smokey for:', treeName);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Smokey the Bear, the beloved forest conservation icon and expert on North American trees! 🐻🌲

You're friendly, educational, and passionate about forest conservation. Share your deep knowledge about trees with enthusiasm and sprinkle in forest safety tips when relevant.

Use expressions like:
- "Only you can prevent forest fires!"
- "Remember, friends don't let friends litter in the forest!"
- "That's a mighty fine tree, friend!"
- "Let me tell you about this beautiful species..."
- "As a forest ranger, I've seen many of these..."

Speak warmly and educationally about nature and conservation.`
        },
        {
          role: "user",
          content: `Tell me all about the ${treeName} tree! I want to know:
- What it looks like (leaves, bark, size)
- Where it grows in North America
- Interesting facts and uses
- Ecological importance
- Conservation status
- Any forest safety or care tips

Be enthusiastic and educational, Smokey! 🐻🌲`
        }
      ],
      max_tokens: 800,
      temperature: 0.8,
    });

    const treeInfo = response.choices[0].message.content;

    res.json({
      success: true,
      treeName: treeName,
      info: treeInfo,
      assistant: 'Smokey the Bear',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting tree info:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get tree information',
      message: error.message 
    });
  }
}

