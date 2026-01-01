import { ExtractorRegistry } from './registry';
import { ChainExtractor } from './ChainExtractor';
import { JsonLdExtractor } from './JsonLdExtractor';
import { ReadabilityExtractor } from './ReadabilityExtractor';

export function registerG8Extractors() {
    const registry = ExtractorRegistry.getInstance();
    const smartStrategy = new ChainExtractor([
        new JsonLdExtractor(),
        new ReadabilityExtractor()
    ]);

    const domains = [
        // USA
        'nytimes\\.com', 'cnn\\.com', 'foxnews\\.com', 'usatoday\\.com', 'washingtonpost\\.com',
        'latimes\\.com', 'nypost\\.com', 'cnbc\\.com', 'wsj\\.com', 'abcnews\\.go\\.com',
        // UK
        'bbc\\.co\\.uk', 'bbc\\.com', 'theguardian\\.com', 'dailymail\\.co\\.uk', 'telegraph\\.co\\.uk',
        'independent\\.co\\.uk', 'express\\.co\\.uk', 'mirror\\.co\\.uk', 'thesun\\.co\\.uk', 'standard\\.co\\.uk', 'metro\\.co\\.uk',
        // Canada
        'cbc\\.ca', 'ctvnews\\.ca', 'globalnews\\.ca', 'theglobeandmail\\.com', 'nationalpost\\.com',
        'torontosun\\.com', 'toronto\\.com', 'ledevoir\\.com', 'lapresse\\.ca', 'journaldemontreal\\.com',
        // France
        'lemonde\\.fr', 'lefigaro\\.fr', 'liberation\\.fr', '20minutes\\.fr', 'ouest-france\\.fr',
        'leparisien\\.fr', 'lesechos\\.fr', 'lci\\.fr', 'francetvinfo\\.fr', 'bfmtv\\.com',
        // Germany
        'bild\\.de', 'spiegel\\.de', 'focus\\.de', 'n-tv\\.de', 'welt\\.de', 'zeit\\.de',
        'faz\\.net', 'sueddeutsche\\.de', 't-online\\.de', 'chip\\.de',
        // Italy
        'corriere\\.it', 'repubblica\\.it', 'gazzetta\\.it', 'ansa\\.it', 'ilsole24ore\\.com',
        'lastampa\\.it', 'ilfattoquotidiano\\.it', 'liberoquotidiano\\.it', 'ilgiornale\\.it', 'fanpage\\.it',
        // Japan
        'yahoo\\.co\\.jp', 'nikkei\\.com', 'asahi\\.com', 'mainichi\\.jp', 'yomiuri\\.co\\.jp',
        'sankei\\.com', 'nhk\\.or\\.jp', 'zakzak\\.co\\.jp', 'news\\.livedoor\\.com',
        // Russia
        'rbc\\.ru', 'lenta\\.ru', 'ria\\.ru', 'tass\\.ru', 'kommersant\\.ru',
        'mk\\.ru', 'gazeta\\.ru', 'kp\\.ru', 'fontanka\\.ru', 'iz\\.ru'
    ];

    // Regex to match these domains. 
    // Matches: start or dot + domain + end or slash
    // e.g. "www.nytimes.com/" matches "nytimes.com"
    const pattern = new RegExp(`(^|\\.)(${domains.join('|')})(/|$)`, 'i');

    registry.register(pattern, smartStrategy);
}
