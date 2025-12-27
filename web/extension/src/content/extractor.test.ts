import { extractMainContent } from './extractor';

describe('extractMainContent', () => {
  it('extracts text from the main article and ignores navigation', () => {
    document.body.innerHTML = `
      <nav>
        <ul><li>Home</li><li>About</li></ul>
      </nav>
      <article>
        <h1>My Great Story</h1>
        <p>This is the first paragraph of the story.</p>
        <p>This is the second paragraph.</p>
      </article>
      <footer>
        <p>Contact us at info@example.com</p>
      </footer>
    `;

    const result = extractMainContent(document);
    expect(result).toContain('This is the first paragraph of the story.');
    expect(result).toContain('This is the second paragraph.');
    expect(result).not.toContain('Home');
    expect(result).not.toContain('About');
    expect(result).not.toContain('Contact us');
  });

  it('prefers the largest text block', () => {
    document.body.innerHTML = `
      <div class="sidebar">Short sidebar text.</div>
      <div class="content">
        <p>This is a much longer piece of text that should be identified as the main content because it has more characters than the sidebar or the navigation elements.</p>
      </div>
    `;

    const result = extractMainContent(document);
    expect(result).toContain('This is a much longer piece of text');
    expect(result).not.toContain('Short sidebar text');
  });

  it('returns empty string if no content found', () => {
    document.body.innerHTML = '';
    const result = extractMainContent(document);
    expect(result).toBe('');
  });

  it('sanitizes dangerous HTML and only keeps allowed tags', () => {
    document.body.innerHTML = `
      <main>
        <h1>Title</h1>
        <p>Safe paragraph.</p>
        <script>alert("xss")</script>
        <div onclick="alert('xss')">Click me</div>
        <iframe src="https://evil.com"></iframe>
        <style>body { color: red; }</style>
      </main>
    `;

    const result = extractMainContent(document);
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<p>Safe paragraph.</p>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('<iframe>');
    expect(result).not.toContain('<style>');
    // DIV is also not in allowed tags
    expect(result).not.toContain('<div>');
  });
});
