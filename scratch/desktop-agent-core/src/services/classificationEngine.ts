export type ProductivityCategory = 'Productive' | 'Unproductive' | 'Neutral';

class ClassificationEngine {
  // Enterprise default classification rules
  private rules: Record<string, ProductivityCategory> = {
    'github.com': 'Productive',
    'stackoverflow.com': 'Productive',
    'jira.com': 'Productive',
    'confluence.com': 'Productive',
    'gitlab.com': 'Productive',
    'bitbucket.org': 'Productive',
    'portal.enterprise.io': 'Productive', // Company internal portal
    
    // Unproductive / Entertainment / Socials
    'youtube.com': 'Unproductive',
    'netflix.com': 'Unproductive',
    'facebook.com': 'Unproductive',
    'instagram.com': 'Unproductive',
    'linkedin.com': 'Unproductive',
    'twitter.com': 'Unproductive',
    'x.com': 'Unproductive',
    'tiktok.com': 'Unproductive',
    'twitch.tv': 'Unproductive',
    
    // Communication & Meetings (Neutral/Default)
    'slack.com': 'Neutral',
    'teams.microsoft.com': 'Neutral',
    'zoom.us': 'Neutral',
    'meet.google.com': 'Neutral',
    'google.com': 'Neutral'
  };

  // Classify domain name
  public classify(domain: string): ProductivityCategory {
    if (!domain) return 'Neutral';
    
    const cleanDomain = domain.toLowerCase().trim();
    
    // Exact match
    if (this.rules[cleanDomain]) {
      return this.rules[cleanDomain];
    }
    
    // Wildcard subdomain matching (e.g. sub.github.com matches github.com)
    for (const ruleDomain of Object.keys(this.rules)) {
      if (cleanDomain.endsWith('.' + ruleDomain) || cleanDomain === ruleDomain) {
        return this.rules[ruleDomain];
      }
    }
    
    return 'Neutral';
  }

  // Register custom classification rules overrides dynamically
  public registerRule(domain: string, category: ProductivityCategory) {
    if (!domain) return;
    this.rules[domain.toLowerCase().trim()] = category;
    console.log(`[Classification Engine] Registered rule override: ${domain} -> ${category}`);
  }

  // Clear or reset custom rules
  public getRules(): Record<string, ProductivityCategory> {
    return { ...this.rules };
  }
}

export const classificationEngine = new ClassificationEngine();
export default classificationEngine;
