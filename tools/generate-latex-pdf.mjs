#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const inputFile = process.argv[2];
const outputDir = 'output';

if (!inputFile) {
  console.error('Usage: node generate-latex-pdf.mjs <input.tex>');
  process.exit(1);
}

const baseName = path.basename(inputFile, '.tex');
const outputFile = path.join(outputDir, `${baseName}.pdf`);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

try {
  console.log(`Compiling ${inputFile}...`);
  execSync(`xelatex -output-directory=${outputDir} ${inputFile}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  execSync(`xelatex -output-directory=${outputDir} ${inputFile}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log(`PDF generated: ${outputFile}`);
} catch (error) {
  console.error('PDF generation failed:', error.message);
  process.exit(1);
}
