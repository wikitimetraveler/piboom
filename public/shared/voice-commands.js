/**
 * Voice Command Parser Utility
 * 
 * Parses natural language voice commands and maps them to filter/search actions
 * for loan pipeline and disaster dashboards.
 * 
 * @file       voice-commands.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 */

/**
 * Parse voice command and return action object
 * @param {string} command - Natural language command
 * @returns {Object} Action object with type and parameters
 */
export function parseVoiceCommand(command) {
    if (!command || typeof command !== 'string') {
        return { type: 'unknown', error: 'Invalid command' };
    }

    const normalized = command.toLowerCase().trim();
    
    // Filter commands
    if (normalized.includes('show') || normalized.includes('filter') || normalized.includes('display')) {
        return parseFilterCommand(normalized);
    }
    
    // Search commands
    if (normalized.includes('search') || normalized.includes('find') || normalized.includes('look for')) {
        return parseSearchCommand(normalized);
    }
    
    // Navigation commands
    if (normalized.includes('go to') || normalized.includes('open') || normalized.includes('expand') || normalized.includes('scroll')) {
        return parseNavigationCommand(normalized);
    }
    
    // Analysis commands
    if (normalized.includes('analyze') || normalized.includes('analysis')) {
        return { type: 'analyze', action: 'analyzeAllLoans' };
    }
    
    // Load FEMA command
    if (normalized.includes('load fema') || normalized.includes('get disasters') || normalized.includes('fetch disasters')) {
        return { type: 'loadFEMA', action: 'loadFEMADisastersDirect' };
    }
    
    return { type: 'unknown', command: normalized };
}

/**
 * Parse filter command
 * @param {string} command - Normalized command string
 * @returns {Object} Filter action object
 */
function parseFilterCommand(command) {
    const filters = {};
    
    // Risk level
    if (command.match(/\b(high|medium|low)\s+risk/)) {
        const riskMatch = command.match(/\b(high|medium|low)\s+risk/);
        filters.riskLevel = riskMatch[1];
    }
    
    // State
    const stateMatch = command.match(/\bin\s+([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
    if (stateMatch) {
        const state = stateMatch[1].toUpperCase();
        // Convert full state names to abbreviations if needed
        const stateAbbr = convertStateNameToAbbr(state);
        if (stateAbbr) {
            filters.state = stateAbbr;
        } else if (state.length === 2) {
            filters.state = state;
        }
    }
    
    // County
    const countyMatch = command.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+county/);
    if (countyMatch) {
        filters.county = countyMatch[1];
    }
    
    // Milestone
    const milestones = ['application', 'processing', 'underwriting', 'closing', 'funded'];
    for (const milestone of milestones) {
        if (command.includes(`milestone ${milestone}`) || command.includes(`${milestone} milestone`)) {
            filters.milestone = milestone.charAt(0).toUpperCase() + milestone.slice(1);
            break;
        }
    }
    
    if (Object.keys(filters).length > 0) {
        return { type: 'filter', filters, action: 'applyFilters' };
    }
    
    return { type: 'unknown', command };
}

/**
 * Parse search command
 * @param {string} command - Normalized command string
 * @returns {Object} Search action object
 */
function parseSearchCommand(command) {
    // Search for loan number
    const loanNumberMatch = command.match(/loan\s+(?:number\s+)?([A-Z0-9-]+)/i);
    if (loanNumberMatch) {
        return { type: 'search', searchType: 'loanNumber', value: loanNumberMatch[1] };
    }
    
    // Search for borrower
    const borrowerMatch = command.match(/borrower\s+(.+?)(?:\s+in|\s+for|$)/i);
    if (borrowerMatch) {
        return { type: 'search', searchType: 'borrower', value: borrowerMatch[1].trim() };
    }
    
    // Search for disaster
    if (command.includes('disaster')) {
        const disasterMatch = command.match(/disaster\s+(.+?)(?:\s+in|\s+for|$)/i);
        if (disasterMatch) {
            return { type: 'search', searchType: 'disaster', value: disasterMatch[1].trim() };
        }
    }
    
    // Generic search - extract search term
    const searchMatch = command.match(/(?:search|find|look for)\s+(?:for\s+)?(.+?)(?:\s+in|\s+for|$)/i);
    if (searchMatch) {
        return { type: 'search', searchType: 'generic', value: searchMatch[1].trim() };
    }
    
    return { type: 'unknown', command };
}

/**
 * Parse navigation command
 * @param {string} command - Normalized command string
 * @returns {Object} Navigation action object
 */
function parseNavigationCommand(command) {
    // Expand accordion sections
    if (command.includes('statistics') || command.includes('charts')) {
        return { type: 'navigate', action: 'expandAccordion', target: 'collapseStatsCharts' };
    }
    if (command.includes('filter') || command.includes('filters')) {
        return { type: 'navigate', action: 'expandAccordion', target: 'collapseFilters' };
    }
    if (command.includes('fema') || command.includes('disaster')) {
        return { type: 'navigate', action: 'expandAccordion', target: 'collapseFEMA' };
    }
    if (command.includes('map') || command.includes('youtube') || command.includes('video')) {
        return { type: 'navigate', action: 'expandAccordion', target: 'collapseMapYouTube' };
    }
    if (command.includes('show loans') || command.includes('affected loans') || command.includes('encompass loans')) {
        return { type: 'navigate', action: 'expandAccordion', target: 'collapseLoans' };
    }
    if (command.includes('loan') || command.includes('encompass')) {
        return { type: 'navigate', action: 'expandAccordion', target: 'collapseLoans' };
    }
    
    return { type: 'unknown', command };
}

/**
 * Convert state name to abbreviation
 * @param {string} stateName - Full state name or abbreviation
 * @returns {string|null} State abbreviation or null
 */
function convertStateNameToAbbr(stateName) {
    const stateMap = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };
    
    const normalized = stateName.toLowerCase().trim();
    return stateMap[normalized] || null;
}

/**
 * Execute parsed command action
 * @param {Object} action - Parsed action object
 * @param {Object} context - Context object with available functions
 * @returns {Promise<Object>} Result of action execution
 */
export async function executeVoiceCommand(action, context = {}) {
    try {
        switch (action.type) {
            case 'filter':
                if (context.applyFilters && action.filters) {
                    // Set filter values
                    if (action.filters.state && context.setStateFilter) {
                        context.setStateFilter(action.filters.state);
                    }
                    if (action.filters.county && context.setCountyFilter) {
                        context.setCountyFilter(action.filters.county);
                    }
                    if (action.filters.riskLevel && context.setRiskFilter) {
                        context.setRiskFilter(action.filters.riskLevel);
                    }
                    if (action.filters.milestone && context.setMilestoneFilter) {
                        context.setMilestoneFilter(action.filters.milestone);
                    }
                    // Apply filters
                    context.applyFilters();
                    return { success: true, message: `Applied filters: ${JSON.stringify(action.filters)}` };
                }
                break;
                
            case 'search':
                if (context.search && action.value) {
                    context.search(action.searchType, action.value);
                    return { success: true, message: `Searching for ${action.searchType}: ${action.value}` };
                }
                break;
                
            case 'navigate':
                if (action.action === 'expandAccordion' && action.target && context.expandAccordion) {
                    context.expandAccordion(action.target);
                    return { success: true, message: `Expanded ${action.target}` };
                }
                break;
                
            case 'analyze':
                if (context.analyzeAllLoans) {
                    context.analyzeAllLoans();
                    return { success: true, message: 'Starting loan analysis...' };
                }
                break;
                
            case 'loadFEMA':
                if (context.loadFEMADisastersDirect) {
                    context.loadFEMADisastersDirect();
                    return { success: true, message: 'Loading FEMA disasters...' };
                }
                break;
                
            default:
                return { success: false, message: 'Unknown command type' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
    
    return { success: false, message: 'Action not available in context' };
}

export default {
    parseVoiceCommand,
    executeVoiceCommand
};

