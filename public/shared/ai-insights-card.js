/**
 * AI Insights Card Component
 * 
 * Auto-generates and displays AI insights for loan pipeline
 * 
 * @file       ai-insights-card.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 */

class AIInsightsCard {
    constructor(config = {}) {
        this.apiEndpoint = config.apiEndpoint || '/api/loan-pipeline/ai/insights';
        this.userId = config.userId || 'anonymous';
        this.containerId = config.containerId || 'aiInsightsContainer';
        this.onInsightsGenerated = config.onInsightsGenerated || null;
        this.autoGenerate = config.autoGenerate !== false; // Default true
        
        this.insights = null;
        this.init();
    }

    init() {
        this.createCard();
    }

    createCard() {
        // Create container if it doesn't exist
        let container = document.getElementById(this.containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            container.className = 'ai-insights-container';
            // Insert at the beginning of main content (after header)
            const mainContent = document.querySelector('.container-fluid') || document.body;
            if (mainContent.firstChild) {
                mainContent.insertBefore(container, mainContent.firstChild);
            } else {
                mainContent.appendChild(container);
            }
        }

        // Add styles if not already added
        if (!document.getElementById('aiInsightsCardStyles')) {
            const styles = document.createElement('style');
            styles.id = 'aiInsightsCardStyles';
            styles.textContent = `
                .ai-insights-container {
                    margin-bottom: 1.5rem;
                }
                .ai-insights-card {
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                    border: 2px solid #0ea5e9;
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
                }
                .ai-insights-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .ai-insights-header h5 {
                    margin: 0;
                    color: #0c4a6e;
                    font-weight: 600;
                }
                .ai-insights-content {
                    color: #1e293b;
                    line-height: 1.6;
                }
                .ai-insights-content ul {
                    margin: 0;
                    padding-left: 1.5rem;
                }
                .ai-insights-content li {
                    margin-bottom: 0.5rem;
                }
                .ai-insights-loading {
                    text-align: center;
                    padding: 1rem;
                    color: #64748b;
                }
                .ai-insights-refresh-btn {
                    background: none;
                    border: none;
                    color: #0ea5e9;
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 0.25rem 0.5rem;
                    transition: transform 0.2s ease;
                }
                .ai-insights-refresh-btn:hover {
                    transform: rotate(180deg);
                }
            `;
            document.head.appendChild(styles);
        }
    }

    async generateInsights(filters = {}, trigger = 'load', selectedDisaster = null) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Show loading state
        container.innerHTML = `
            <div class="ai-insights-card">
                <div class="ai-insights-loading">
                    <i class="bi bi-hourglass-split"></i> Generating insights...
                </div>
            </div>
        `;

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters,
                    trigger,
                    selectedDisaster,
                    userId: this.userId
                })
            });

            const data = await response.json();

            if (data.success && data.insights) {
                this.insights = data.insights;
                this.displayInsights(data.insights, trigger);
                
                if (this.onInsightsGenerated) {
                    this.onInsightsGenerated(data.insights, data);
                }
            } else {
                this.displayError('Failed to generate insights');
            }
        } catch (error) {
            console.error('Insights generation error:', error);
            this.displayError('Error generating insights. Please try again.');
        }
    }

    displayInsights(insights, trigger) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Parse insights (could be markdown or plain text)
        const formattedInsights = this.formatInsights(insights);

        container.innerHTML = `
            <div class="ai-insights-card">
                <div class="ai-insights-header">
                    <h5><i class="bi bi-lightbulb"></i> AI Insights</h5>
                    <button class="ai-insights-refresh-btn" onclick="window.aiInsightsCard?.generateInsights(window.currentFilters || {}, 'manual')" title="Refresh Insights">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
                <div class="ai-insights-content">
                    ${formattedInsights}
                </div>
            </div>
        `;
    }

    formatInsights(insights) {
        // Convert markdown-style lists to HTML
        let formatted = insights;
        
        // Convert bullet points
        formatted = formatted.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive list items in ul tags
        formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        
        // Convert line breaks to <br>
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    displayError(message) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="ai-insights-card">
                <div class="ai-insights-content" style="color: #ef4444;">
                    <i class="bi bi-exclamation-triangle"></i> ${message}
                </div>
            </div>
        `;
    }
}

// Make available globally
window.AIInsightsCard = AIInsightsCard;

export default AIInsightsCard;

