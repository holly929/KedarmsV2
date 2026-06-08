const fs = require('fs');
const { globSync } = require('glob');

/**
 * Custom script to find and fix unescaped HTML entities in JSX text nodes.
 * Detects characters that trigger 'react/no-unescaped-entities': > " ' }
 */
function fixUnescapedEntities() {
  const args = process.argv.slice(2);
  // Use provided arguments if available (from lint-staged), otherwise fallback to glob
  const files = args.length > 0 ? args : globSync('src/**/*.{tsx,jsx}');
  
  // Heuristic regex:
  // Matches text between tag/expression boundaries (>, }, <, {)
  // that contains forbidden characters and is NOT inside a { expression }.
  const unescapedRegex = /(?<=>|\})([^<>{]*?[>"'\}][^<>{]*?)(?=<|\{)/g;

  files.forEach((file) => {
    if (!fs.existsSync(file)) return;

    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    content = content.replace(unescapedRegex, (textContent) => {
      const fixedText = textContent
        .replace(/'/g, '&apos;')
        .replace(/"/g, '&quot;')
        .replace(/>/g, '&gt;')
        .replace(/}/g, '&#125;');
      
      return fixedText;
    });

    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Fixed unescaped entities in: ${file}`);
    }
  });
}

fixUnescapedEntities();