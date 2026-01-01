import { extractMainContent } from './extractor';
import { JSDOM } from 'jsdom';

describe('MSN Extraction Repro', () => {
    // Mock window.location for the extractor to use
    const mockLocation = (url: string) => {
        Object.defineProperty(window, 'location', {
            value: new URL(url),
            writable: true
        });
    };

    it('extracts only the content for the current video in a feed', () => {
        // Simulate visiting the specific video URL
        const targetId = 'AA1T52jr';
        mockLocation(`https://www.msn.com/en-au/news/other/i-thought-he-was-playing-a-prank-until-he-snapped-my-leg/vi-${targetId}`);

        document.body.innerHTML = `
        <div role="main" class="watch-feed">
             <!-- Previous Video/Item -->
             <div id="PREV123" class="feed-item-container">
                <h1>Previous Story Title</h1>
                <p>This content should NOT be extracted.</p>
             </div>

             <!-- TARGET Video/Item -->
             <div id="${targetId}" class="feed-item-container active">
                <h1>Target Story Title</h1>
                <div slot="abstract">
                    <text-inline-expander text="This is the target content. It should be extracted." line-count-clamp-see-more="1">
                        <!-- usually text-inline-expander might have shadow dom or inner text, 
                             but our extractor likely just grabs textContent if not handled specifically. 
                             Let's assume simple textContent for now or mimic structure if needed. -->
                        This is the target content. It should be extracted.
                    </text-inline-expander>
                </div>
             </div>

             <!-- Next Video/Item -->
             <div id="NEXT456" class="feed-item-container">
                <h1>Next Story Title</h1>
                <p>This is the next story. It should NOT be extracted.</p>
             </div>
        </div>
        `;

        const result = extractMainContent(document);

        // Verification
        expect(result).toContain('Target Story Title');
        expect(result).toContain('This is the target content');

        // Fails if it scoops everything up
        expect(result).not.toContain('Previous Story Title');
        expect(result).not.toContain('Next Story Title');
    });

    it('handles text-inline-expander attributes correctly', () => {
        document.body.innerHTML = `
             <div id="content">
                <text-inline-expander text="Hidden attribute text." line-count-clamp-see-more="1">
                    Visible text.
                </text-inline-expander>
             </div>
        `;
        // Assuming we want the text from the attribute if the innerHTML is complex or lazy loaded?
        // Or actually the attribute 'text' often contains the full clean text in these components.
        // Let's see what current behavior gives.
        const result = extractMainContent(document);
        // If it relies on standard textContent, it gets "Visible text."
        // If we verify the user expectation, we might need to look at attributes for these custom elements.
    });
});
