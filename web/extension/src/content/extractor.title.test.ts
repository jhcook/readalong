
import { extractMainContent } from './extractor';

describe('Extractor Title Heuristic', () => {
    let container: HTMLElement;
    let originalTitle: string;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        originalTitle = document.title;
    });

    afterEach(() => {
        document.body.removeChild(container);
        document.body.innerHTML = '';
        document.title = originalTitle;
    });

    test('Prioritizes content containing the document title', () => {
        // Set the page title (simulating the MSN tab title)
        document.title = "Tesla's former AI chief Andrej Karpathy warns software engineers - MSN";

        // 1. Create a "Distraction" article (e.g. "Democrats on House Oversight...")
        // Give it a HIGH score (dense text, h2)
        const distraction = document.createElement('article');
        distraction.className = 'distraction';
        const h2 = document.createElement('h2');
        h2.textContent = "Democrats on the House Oversight Committee";
        distraction.appendChild(h2);
        
        let distractionText = '';
        for (let i = 0; i < 10; i++) {
             distractionText += "This is a very dense paragraph about the oversight committee. It has many words and few links. ".repeat(3);
        }
        const p1 = document.createElement('p');
        p1.textContent = distractionText;
        distraction.appendChild(p1);
        container.appendChild(distraction);

        // 2. Create the "Main" article
        // It might be split or slightly less dense, BUT it has the Title.
        const mainArticle = document.createElement('article');
        mainArticle.className = 'main-article';
        
        const h1 = document.createElement('h1');
        // Matches the title (mostly)
        h1.textContent = "Tesla's former AI chief Andrej Karpathy warns software engineers"; 
        mainArticle.appendChild(h1);

        let mainText = '';
        for (let i = 0; i < 5; i++) {
             mainText += "Andrej Karpathy said something important. ".repeat(2);
        }
        const p2 = document.createElement('p');
        p2.textContent = mainText;
        mainArticle.appendChild(p2);
        container.appendChild(mainArticle);

        // Verify premise: Distraction has more text/score potentially
        expect(distraction.textContent!.length).toBeGreaterThan(mainArticle.textContent!.length);

        // Run extractor
        const extracted = extractMainContent(document);

        // Expectation: Should match Main Article because of Title match
        expect(extracted).toContain("Tesla's former AI chief");
        expect(extracted).not.toContain("Democrats on the House Oversight");
    });
});
