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
        this.onOpenPortfolioAnalyst = config.onOpenPortfolioAnalyst || null;
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

    async generateInsights(filters = {}, trigger = 'load', selectedDisaster = null, extra = {}) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        this._lastFilters = filters;
        this._lastTrigger = trigger;
        this._lastDisaster = selectedDisaster;
        this._lastExtra = extra || {};

        // Show loading state
        container.innerHTML = `
            <div class="ai-insights-card">
                <div class="ai-insights-loading">
                    <i class="bi bi-hourglass-split"></i> Checking the portfolio…
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
                    userId: this.userId,
                    expertProfile: extra.expertProfile || (trigger === 'disaster' ? 'portfolio' : undefined),
                    nearbyLoans: extra.nearbyLoans || undefined,
                    loanFilterMeta: extra.loanFilterMeta || undefined,
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
                this.displayError('Couldn’t load insights — try again.');
            }
        } catch (error) {
            console.error('Insights generation error:', error);
            this.displayError('Couldn’t load insights — try again.');
        }
    }

    displayInsights(insights, trigger) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Parse insights (could be markdown or plain text)
        const formattedInsights = this.formatInsights(insights);
        const showPortfolioCta = trigger === 'disaster' || trigger === 'manual';

        container.innerHTML = `
            <div class="ai-insights-card">
                <div class="ai-insights-header">
                    <h5><i class="bi bi-pie-chart"></i> Portfolio read</h5>
                    <button type="button" class="ai-insights-refresh-btn" data-ai-insights-refresh title="Refresh">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
                <div class="ai-insights-content">
                    ${formattedInsights}
                </div>
                ${showPortfolioCta ? `<div class="ai-insights-actions mt-2">
                  <button type="button" class="btn btn-sm btn-primary" data-open-portfolio-analyst>
                    <i class="bi bi-chat-dots"></i> Ask portfolio analyst
                  </button>
                </div>` : ''}
            </div>
        `;

        container.querySelector('[data-ai-insights-refresh]')?.addEventListener('click', () => {
            this.generateInsights(
                this._lastFilters || {},
                this._lastTrigger || 'disaster',
                this._lastDisaster,
                this._lastExtra || {}
            );
        });
        container.querySelector('[data-open-portfolio-analyst]')?.addEventListener('click', () => {
            if (typeof this.onOpenPortfolioAnalyst === 'function') {
                this.onOpenPortfolioAnalyst();
            } else if (typeof window.openPortfolioAnalyst === 'function') {
                window.openPortfolioAnalyst();
            }
        });
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

