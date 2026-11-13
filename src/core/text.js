/**
 * Wrap every character under `root` in a span.char, leaving the existing
 * element structure exactly as written. Screen readers get the text once,
 * through an aria-label on the root.
 */
export function splitChars(root) {
  root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  const chars = [];
  for (const node of textNodes) {
    const pieces = [...node.textContent].map((character) => {
      if (!character.trim()) return document.createTextNode(' ');
      const span = document.createElement('span');
      span.className = 'char';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = character;
      chars.push(span);
      return span;
    });
    // Keep a space only where it follows a letter; drop source indentation.
    node.replaceWith(...pieces.filter((piece, i) => piece.nodeType === 1 || pieces[i - 1]?.nodeType === 1));
  }
  return chars;
}
