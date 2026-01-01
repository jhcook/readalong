import { extractMainContent, sanitizeContent } from './extractor';

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
      <aside>Short sidebar text.</aside>
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
    document.title = "Page Title";
    document.body.innerHTML = `
      <main>
        <h1>Page Title</h1>
        <p>Safe paragraph.</p>
        <script>alert("xss")</script>
        <div onclick="alert('xss')">Click me</div>
        <iframe src="https://evil.com"></iframe>
        <style>body { color: red; }</style>
      </main>
    `;

    const result = extractMainContent(document);
    // Readability may adjust headers or structure, but content should be preserved
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('<iframe>');
    expect(result).not.toContain('<style>');

    // Check for content presence
    // Note: Readability might strip title if it matches document.title, but we manually re-add it if available unless logic changed.
    // In our implementation we re-add it.
    expect(result).toContain('<h1>Page Title</h1>');
    expect(result).toContain('Safe paragraph.');
  });

  it('ignores return to homepage links (Yahoo News repro)', () => {
    document.title = "Bins Photographed";
    document.body.innerHTML = `
      <header>
        <div class="nav-container">
            <a href="/">Return to homepage</a>
        </div>
      </header>
        <article>
         <h1>Bins have been photographed</h1>
         <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
         <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
         <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
       </article>
     `;
    const result = extractMainContent(document);
    expect(result).not.toContain('Return to homepage');
    expect(result).toContain('Bins have been photographed');
    expect(result).toContain('Lorem ipsum');
  });
});

describe('sanitizeContent', () => {
  it('sanitizes dangerous HTML and only keeps allowed tags', () => {
    const input = `
            <h1>Title</h1>
            <p>Safe paragraph.</p>
            <script>alert("xss")</script>
            <div onclick="alert('xss')">Click me</div>
            <iframe src="https://evil.com"></iframe>
            <style>body { color: red; }</style>
        `;
    const result = sanitizeContent(input);
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<p>Safe paragraph.</p>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('<iframe>');
    expect(result).not.toContain('<style>');
    // div is now allowed
    expect(result).toContain('<div>Click me</div>');
  });
  it('filters out generic noisy content like app downloads and captions', () => {
    document.title = "News Article";
    document.body.innerHTML = `
      <article>
        <h1>Main News Story</h1>
        <figure>
            <img src="img.jpg">
            <figcaption>This is a picture caption that should be removed.</figcaption>
        </figure>
        <div class="caption">Another caption style.</div>
        <p>This is the actual news content that we want to read. It needs to be sufficiently long so that the Readability algorithm determines it is main content and not just a sidebar or foot note. Adding more words here to ensure it passes the threshold.</p>
        <p>DOWNLOAD THE 9NEWS APP for more stories.</p>
        <div class="copyright">Copyright 2024 News Corp</div>
        <p>Follow us on <a href="#">Twitter</a> for updates.</p>
        <div class="related-stories">
            <h3>Top Stories</h3>
            <ul><li>Other story 1</li></ul>
        </div>
      </article>
    `;

    const result = extractMainContent(document);

    // Content we WANT
    expect(result).toContain('Main News Story');
    expect(result).toContain('This is the actual news content');

    // Content we DO NOT WANT
    expect(result).not.toContain('picture caption');
    expect(result).not.toContain('Another caption style');
    expect(result).not.toContain('DOWNLOAD THE 9NEWS APP');
    expect(result).not.toContain('Copyright 2024');
    expect(result).not.toContain('Top Stories');
  });

  it('removes citation markers from reference sites (Wikipedia style)', () => {
    document.body.innerHTML = `
      <p>Artificial intelligence[1] is intelligence exhibited by machines.[2]</p>
      <p>It is a field of research.[citation needed]</p>
    `;
    const result = extractMainContent(document);
    expect(result).toContain('Artificial intelligence is intelligence exhibited by machines.');
    expect(result).toContain('It is a field of research.');
    expect(result).not.toContain('[1]');
    expect(result).not.toContain('[2]');
    expect(result).not.toContain('[2]');
    expect(result).not.toContain('[citation needed]');
  });

  it('filters out aggressive comment sections', () => {
    document.body.innerHTML = `
      <article>
        <h1>Article Title</h1>
        <p>Main content.</p>
        <div class="user-comments-section">
            <h3>User Comments</h3>
            <p>I disagree with this article!</p>
        </div>
        <div id="discussion-board">
            <p>More discussion here.</p>
        </div>
        <section aria-label="Comments">
            <p>Even more comments.</p>
        </section>
      </article>
    `;
    const result = extractMainContent(document);
    expect(result).toContain('Main content.');
    expect(result).not.toContain('User Comments');
    expect(result).not.toContain('I disagree');
    expect(result).not.toContain('More discussion');
    expect(result).not.toContain('Even more comments');
  });
});
