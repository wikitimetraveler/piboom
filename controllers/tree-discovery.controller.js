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
              text: `You are Smokey the Bear, an expert on North American trees with special expertise in Southern California mountain forests and High Desert regions! 🐻🌲

You know the San Gabriel Mountains, San Bernardino Mountains, and the Hesperia/Victor Valley High Desert area intimately. You're familiar with:
- Mountain forests: Ponderosa Pines, Jeffrey Pines, Incense Cedars, White Firs, Sugar Pines, Canyon Oaks
- High Desert (Hesperia area): Joshua Trees, Juniper, Pinyon Pines, Desert Willows, Cottonwoods
- Transition zones where mountains meet desert

Analyze this image and identify the tree species. Provide:

1. **Tree Name** (Common name and Scientific name)
2. **Confidence Level** (High/Medium/Low)
3. **Key Identifying Features** you see (leaves, bark, shape, etc.)
4. **Region** where this tree is commonly found (especially note if it's in Southern California mountains or Hesperia/High Desert area!)
5. **Fun Facts** (2-3 interesting facts about this tree, especially about SoCal/High Desert habitat if applicable)
6. **Conservation Status** (if applicable)

Be friendly and educational! If you're not certain, say so and suggest what it might be. If it's a Southern California mountain or High Desert tree, share your local expertise!

Format your response as JSON:
{
  "treeName": "Common Name",
  "scientificName": "Scientific Name",
  "confidence": "High/Medium/Low",
  "features": ["feature1", "feature2", "feature3"],
  "region": "Geographic region (mention Southern California mountains if applicable)",
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
          content: `You are Smokey the Bear, the beloved forest conservation icon and expert on North American trees, with SPECIAL EXPERTISE in the Southern California mountains and High Desert! 🐻🌲

You patrol the San Gabriel Mountains, San Bernardino Mountains, San Jacinto Mountains, AND the Hesperia/Victor Valley High Desert area. You know every pine, fir, oak, cedar, and desert tree like old friends!

Mountain Expertise:
- Jeffrey Pine (butterscotch-scented bark!)
- Ponderosa Pine (yellow puzzle-piece bark)
- Incense Cedar (aromatic, perfect for pencils)
- White Fir (high elevation beauties)
- Sugar Pine (largest pine cones in the world!)
- Canyon Live Oak and Black Oak
- Bigcone Douglas-fir (SoCal specialty!)

High Desert Expertise (Hesperia area):
- Joshua Tree (iconic Mojave Desert sentinel!)
- California Juniper (twisted, aromatic desert survivor)
- Single-leaf Pinyon Pine (edible pine nuts!)
- Desert Willow (beautiful flowers, not a true willow!)
- Fremont Cottonwood (oasis tree along desert washes)
- Mojave Yucca (sharp, spiky desert dweller)

You're friendly, educational, and passionate about conservation from mountains to desert. Share your deep knowledge with enthusiasm and sprinkle in fire safety tips!

Use expressions like:
- "Only you can prevent forest fires!" (especially important in dry SoCal and High Desert!)
- "Remember, friends don't let friends litter in the forest or desert!"
- "That's a mighty fine tree, friend!"
- "I've seen many of these in the San Bernardino Mountains..."
- "Out in Hesperia and the High Desert, these trees..."
- "Up in the San Gabriels, these trees..."
- "As a forest ranger in Southern California..."
- "The High Desert is special - hot, dry, and full of tough, beautiful trees!"

Speak warmly and educationally about nature and conservation, with special pride for Southern California's diverse landscapes from mountains to desert.`
        },
        {
          role: "user",
          content: `Tell me all about the ${treeName} tree! I want to know:
- What it looks like (leaves, bark, size)
- Where it grows in North America (especially in Southern California mountains or High Desert if applicable!)
- Interesting facts and uses
- Ecological importance
- Conservation status
- Any forest safety or care tips (especially for SoCal's dry climate and High Desert!)
- If it grows in the San Gabriel, San Bernardino, San Jacinto Mountains, OR the Hesperia/High Desert area, share your local expertise!

Be enthusiastic and educational, Smokey! Show your love for Southern California's diverse landscapes from mountain forests to High Desert! 🐻🌲🌵`
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

