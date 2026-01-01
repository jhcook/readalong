import { ExtractorRegistry } from './registry';
import { ChainExtractor } from './ChainExtractor';
import { JsonLdExtractor } from './JsonLdExtractor';
import { ReadabilityExtractor } from './ReadabilityExtractor';

import { DOMAINS_NEWS } from './lists/domains_news';
import { DOMAINS_ECOMMERCE } from './lists/domains_ecommerce';
import { DOMAINS_GOVERNMENT } from './lists/domains_government';
import { DOMAINS_EDUCATION } from './lists/domains_education';
import { DOMAINS_PLATFORMS } from './lists/domains_platforms';

export function registerG20Extractors() {
    const registry = ExtractorRegistry.getInstance();

    // We use the same ChainExtractor strategy for all these sites as a baseline.
    // Ideally, specific sites would have custom extractors, but Readability + JsonLD is a strong default.
    const smartStrategy = new ChainExtractor([
        new JsonLdExtractor(),
        new ReadabilityExtractor()
    ]);

    const allDomains = [
        ...DOMAINS_NEWS,
        ...DOMAINS_ECOMMERCE,
        ...DOMAINS_GOVERNMENT,
        ...DOMAINS_EDUCATION,
        ...DOMAINS_PLATFORMS
    ];

    // Deduplicate domains just in case
    const uniqueDomains = [...new Set(allDomains)];

    // Regex to match these domains. 
    // Matches: start (^) or dot (\.) + domain + end ($) or slash (/)
    // e.g. "www.nytimes.com/" matches "nytimes.com"
    // We process in chunks if the regex is too large, 
    // but for ~500 domains a single regex is usually fine in modern JS engines.
    const pattern = new RegExp(`(^|\\.)(${uniqueDomains.join('|')})(/|$)`, 'i');

    registry.register(pattern, smartStrategy);
}
