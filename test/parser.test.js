import { describe, it, expect } from 'vitest';
import ContentParser from '../parser.js';

describe('ContentParser Engine', () => {
  it('correctly parses JSON content packages', () => {
    const mockJson = {
      pages: [
        {
          PageName: 'Home',
          AIContent: {
            meta_data: {
              heading: 'Home | Acme Web Services',
              description: 'Professional web design and digital strategy.'
            },
            headline: 'Modern Web Solutions for Growing Teams',
            services_title: 'How we help your company succeed',
            service_01: {
              headline: 'Web Design',
              summary: 'Custom UI/UX responsive designs.',
              button: 'Explore Design',
              link: '/web-design'
            },
            service_02: {
              headline: 'Web Development',
              summary: 'Full-stack performant web applications.',
              button: 'Explore Dev',
              link: '/web-development'
            }
          }
        }
      ],
      business: {
        company_name: 'Acme Solutions',
        telephone: '01892 346007'
      }
    };

    const parsed = ContentParser.parse(JSON.stringify(mockJson));
    expect(parsed.pages.length).toBe(1);

    const home = parsed.pages.find(p => p.name === 'Home');
    expect(home).toBeDefined();
    expect(home.services.length).toBe(2);
    expect(home.services[0].title).toBe('Web Design');
    expect(home.services[0].buttonLink).toBe('/web-design');
    expect(home.servicesTitle).toBe('How we help your company succeed');
  });

  it('correctly parses Google Doc / Word HTML content', () => {
    const mockHtml = `
      <table>
        <tr><td>Company Name: Acme Solutions</td><td>Main Address: 10 High Street, London</td></tr>
        <tr><td>Phone: 01892 346007</td><td>Email: hello@acme.com</td></tr>
      </table>
      <table>
        <tr><td>Page Title</td><td>Home | Acme Solutions</td></tr>
        <tr><td>Meta Description</td><td>Clean web solutions.</td></tr>
        <tr><td>H1</td><td>Reliable web solutions for your business</td></tr>
      </table>
      <h2>Our Core Services</h2>
      <p>Custom software tailored to your requirements.</p>
      <ul>
        <li>Fast turnarounds</li>
        <li>Enterprise security</li>
      </ul>
    `;

    const parsed = ContentParser.parse(mockHtml);
    expect(parsed.pages.length).toBeGreaterThan(0);

    const home = parsed.pages.find(p => p.name === 'Home');
    expect(home).toBeDefined();
    expect(home.hero.h1).toContain('Reliable web solutions');
    expect(home.bulletList.items.length).toBe(2);
    expect(parsed.businessInfo.companyName).toBe('Acme Solutions');
    expect(parsed.businessInfo.phone).toBe('01892 346007');
    expect(parsed.businessInfo.phoneLink).toBe('+441892346007');
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

  it('slugifies titles into clean kebab-case IDs', () => {
    expect(ContentParser.slugify('Chimney Sweeping & Maintenance!')).toBe('chimney-sweeping-maintenance');
    expect(ContentParser.slugify('Burner & Stove Repairs (Page 7)')).toBe('burner-stove-repairs-page-7');
  });
});
