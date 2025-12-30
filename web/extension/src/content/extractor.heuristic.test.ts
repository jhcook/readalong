
import { extractMainContent } from './extractor';

describe('Extractor Heuristics', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
        document.body.innerHTML = '';
    });

    test('Prioritizes dense paragraph content over link-heavy sidebars', () => {
        // 1. Create a "Sidebar" / "Related" section with LOTS of text but in links/lists
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.id = 'content'; // Confusing ID that might be picked up
        
        let sidebarText = '';
        const ul = document.createElement('ul');
        for (let i = 0; i < 50; i++) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            const text = `Related article number ${i} about some topic that is very interesting and clickbaity - read more here now. `;
            a.textContent = text;
            a.href = '#';
            sidebarText += text;
            li.appendChild(a);
            ul.appendChild(li);
        }
        sidebar.appendChild(ul);
        container.appendChild(sidebar);

        // 2. Create "Main Article" with dense text paragraphs
        const article = document.createElement('article');
        article.className = 'real-article';
        
        const h1 = document.createElement('h1');
        h1.textContent = "The Real Article Title";
        article.appendChild(h1);

        let articleText = '';
        for (let i = 0; i < 5; i++) {
            const p = document.createElement('p');
            const text = `This is a paragraph of the actual article content. It contains full sentences and substantive information that the user actually wants to read. It is not just a list of links. Paragraph ${i}. `;
            p.textContent = text;
            articleText += text;
            article.appendChild(p);
        }
        container.appendChild(article);

        // Verify the premise: Sidebar has MORE text than article
        expect(sidebarText.length).toBeGreaterThan(articleText.length);

        // Run extractor
        const extracted = extractMainContent(document);

        // Expectation: Should contain article content, NOT sidebar content
        expect(extracted).toContain('The Real Article Title');
        expect(extracted).toContain('This is a paragraph of the actual article content');
        expect(extracted).not.toContain('Related article number');
    });
});
