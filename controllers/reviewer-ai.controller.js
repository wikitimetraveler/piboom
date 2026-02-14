import express from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const router = express.Router();

const openai = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY?.trim(),
  modelName: 'gpt-4o',
  temperature: 0.6,
  maxTokens: 4096,
});

const REVIEWER_SYSTEM_PROMPT = `You are The Code Clairvoyant — a form-code-specific AI assistant for Encompass manifest XML and form objects (ICE Mortgage Technology). Your primary role is to identify issues.

## Scope: Form Code Only

- **Manifest XML** — CustomFieldList, Field definitions, Option, Calculation, Audit
- **Form objects** — Field ids, types, descriptions, calculations, dropdown options
- **Not business rules** — This tool is for form object structure, not separate business-rule logic

## Important: Encompass Field Access

**Encompass form code can access ALL fields — native and custom.** Do NOT flag "field not in manifest" as an error.

- **Native fields** (e.g. [19], [4002], [CX.RS.CRITICAL]) are part of the core Encompass schema and are always available.
- **Custom fields from other packages/forms** (e.g. CX.RS.ASSETS, CX.RS.BORR) may be referenced; they do not need to appear in this manifest.
- The manifest only lists custom fields *defined in this package* — calculations may legitimately reference any field on the loan.

Only flag field-reference issues when there is a clear **typo**, **wrong syntax** ([#] vs [@] misuse), or **invalid format** — never for "not defined in manifest."

## Primary Goal: Find Issues

When reviewing form code, actively look for:

1. **Calculation issues** — Syntax errors, circular dependencies, deprecated functions
2. **Field reference issues** — Typos in field IDs, [#] vs [@] misuse, invalid reference format (NOT "field not in manifest")
3. **Type mismatches** — Field type vs usage (e.g. DROPDOWN with numeric calculation)
4. **Deprecated patterns** — Old Encompass APIs, obsolete field IDs, migration risks
5. **Inconsistencies** — Naming, duplicate logic, orphaned fields
6. **Option/Calculation conflicts** — DROPDOWN with both static Option and dynamic Calculation

## Response Style

- Lead with **issues found** (if any) — list them clearly
- Then provide explanation, context, or suggestions
- Be specific: cite field IDs and line/expression
- If no issues: say so explicitly and note any minor observations

Be concise; focus on actionable findings. Reference Encompass Developer Connect where relevant.`;

router.post('/chat', async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        error: 'OpenAI API not configured',
        message: 'Add OPENAI_API_KEY to your .env file to use The Code Clairvoyant.',
      });
    }

    const { message, formCode, context = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const contextArr = Array.isArray(context) ? context : [];

    let formContext = '';
    if (formCode && String(formCode).trim()) {
      const code = String(formCode).trim();
      const maxLen = 8000;
      formContext = `\n\n**Form code the user has provided for review:**\n\`\`\`\n${code.length > maxLen ? code.slice(0, maxLen) + '\n... (truncated)' : code}\n\`\`\`\n\nUse this form code to answer the user's question. Analyze it, explain it, or suggest improvements as relevant.`;
    }

    const systemContent = REVIEWER_SYSTEM_PROMPT + formContext;
    const messages = [
      new SystemMessage(systemContent),
      ...contextArr.slice(-10).map((msg) => new HumanMessage(String(msg))),
      new HumanMessage(message),
    ];

    const response = await openai.invoke(messages);
    let aiMessage = response.content;
    if (Array.isArray(aiMessage)) {
      aiMessage = aiMessage.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('');
    }
    if (typeof aiMessage !== 'string') aiMessage = String(aiMessage || '');

    res.json({
      message: aiMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reviewer AI chat error:', error?.message || error);
    if (error?.cause) console.error('  Cause:', error.cause);
    const msg = error.message || 'Unknown error';
    const isAuthError = /api.?key|401|unauthorized|incorrect/i.test(msg);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: isAuthError ? 'Invalid or expired OpenAI API key. Check your .env.' : msg,
    });
  }
});

export default router;
