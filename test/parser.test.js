import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ContentParser from '../parser.js';

describe('ContentParser Engine', () => {
  it('correctly parses JSON content packages', () => {
    const jsonPath = path.resolve(__dirname, '../0017111676_d9e2953f-edc5-406d-b6ed-82806fecf037_package__generated_content.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const parsed = ContentParser.parse(raw);
      expect(parsed.pages.length).toBeGreaterThan(0);

      const home = parsed.pages.find(p => p.name === 'Home');
      expect(home).toBeDefined();
      expect(home.services.length).toBe(6);
      expect(home.services[0].title).toBe('Chimney sweeping');
      expect(home.services[0].buttonLink).toBe('/chimney-sweeping');
      expect(home.servicesTitle).toBe('How we help keep your chimney working safely');
    }
  });

  it('correctly parses Google Doc HTML content', () => {
    const htmlPath = path.resolve(__dirname, '../17111676_Southborough_Sweep_Upgrade.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      const parsed = ContentParser.parse(html);
      expect(parsed.pages.length).toBeGreaterThan(0);

      const home = parsed.pages.find(p => p.name === 'Home');
      expect(home).toBeDefined();
      expect(home.hero.h1).toContain('Chimney services');
      expect(home.services.length).toBeGreaterThan(0);
      expect(home.bulletList.items.length).toBeGreaterThan(0);
    }
  });

  it('correctly handles plain text briefs', () => {
    const text = `
# Page: Chimney Sweeping
H1: Professional Sweeping in Tunbridge Wells
H2: Keep your chimney safe
• Removes soot deposits
• Clears creosote safely
    `.trim();

    const parsed = ContentParser.parse(text);
    expect(parsed.pages.length).toBe(1);
    expect(parsed.pages[0].name).toBe('Chimney Sweeping');
    expect(parsed.pages[0].hero.h1).toBe('Professional Sweeping in Tunbridge Wells');
    expect(parsed.pages[0].mainSection.h2).toBe('Keep your chimney safe');
    expect(parsed.pages[0].bulletList.items).toHaveLength(2);
  });

  it('correctly parses .docx Word files via mammoth', async () => {
    const docxPath = path.resolve(__dirname, '../17111676_Southborough_Sweep_Upgrade.docx');
    if (fs.existsSync(docxPath)) {
      const mammoth = await import('mammoth');
      const buffer = fs.readFileSync(docxPath);
      const res = await mammoth.default.convertToHtml({ buffer });
      const parsed = ContentParser.parse(res.value);
      expect(parsed.pages.length).toBeGreaterThan(10);
      expect(parsed.businessInfo.companyName).toBe('The Southborough Sweep');
      expect(parsed.businessInfo.phone).toBe('01892 346007');
    }
  });

  it('slugifies titles into clean kebab-case IDs', () => {
    expect(ContentParser.slugify('Chimney Sweeping & Maintenance!')).toBe('chimney-sweeping-maintenance');
    expect(ContentParser.slugify('Burner & Stove Repairs (Page 7)')).toBe('burner-stove-repairs-page-7');
  });
});
