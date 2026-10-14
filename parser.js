/**
 * =========================================================================
 * ContentFlow Parser Engine - V2 DOM-Tree Line & Block Parser
 * Robust extraction of Google Doc HTML, AI JSON, and Summary Briefs
 * =========================================================================
 */

const ContentParser = {
  parse(input) {
    if (!input) return { pages: [], businessInfo: {}, source: 'empty' };

    if (typeof input === 'object' && input !== null) {
      return this.parseJSON(input);
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.parseJSON(parsed);
        } catch (e) {}
      }

      if (trimmed.includes('<html') || trimmed.includes('<body') || trimmed.includes('<table') || trimmed.includes('<p class=')) {
        return this.parseHTML(trimmed);
      }

      return this.parseSummaryText(trimmed);
    }

    return { pages: [], businessInfo: {}, source: 'unknown' };
  },

  /**
   * Parse HTML by reading structured DOM blocks with preserved boundaries
   */
  parseHTML(htmlString) {
    if (typeof DOMParser === 'undefined') {
      return { pages: [], businessInfo: {}, source: 'error' };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const businessInfo = this.extractBusinessInfoFromHTML(doc);
    const pages = this.extractPagesFromDOM(doc);

    return {
      pages,
      businessInfo,
      source: 'google_doc_html',
      rawLength: htmlString.length,
      parsedAt: new Date().toISOString()
    };
  },

  extractBusinessInfoFromHTML(doc) {
    const info = {
      companyName: '',
      address: '',
      phone: '',
      phoneButton: '',
      phoneLink: '',
      phoneTelUri: '',
      email: '',
      hours: '',
      socialMedia: []
    };

    const textLines = this.getCleanTextLines(doc.body);
    const fullText = textLines.join('\n');

    // 1. Company Name
    const compMatch = fullText.match(/Company Name\s*[-–:]\s*([^\n\r]+)/i);
    if (compMatch) {
      info.companyName = compMatch[1].replace(/Main Address.*$/i, '').trim();
    }

    // 2. Main Address
    const addrMatch = fullText.match(/Main Address\s*([\s\S]*?)(?=\[Tel\]|Call:|Opening Hours|Social Media|\+44|01892)/i);
    if (addrMatch) {
      info.address = addrMatch[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.toLowerCase().includes('company') && !l.toLowerCase().includes('address'))
        .join(', ');
    }

    // 3. Clean Phone Number extraction
    const phoneMatch = fullText.match(/\b(0\d{3,4}\s*\d{3,6})\b/);
    if (phoneMatch) {
      const cleanNum = phoneMatch[1].trim(); // e.g. "01892 346007"
      info.phone = cleanNum;
      info.phoneButton = `Call: ${cleanNum}`;
      
      const intlNum = '+44' + cleanNum.replace(/\s+/g, '').replace(/^0/, '');
      info.phoneLink = intlNum; // "+441892346007"
      info.phoneTelUri = `tel:${intlNum}`; // "tel:+441892346007"
    }

    // 4. Email
    const emailMatch = fullText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
    if (emailMatch) info.email = emailMatch[1].trim();

    // 5. Hours
    const hoursMatch = fullText.match(/Opening Hours\s*([\s\S]*?)(?=QA Feedback|SITE MAP|Home|$)/i);
    if (hoursMatch) {
      info.hours = hoursMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.includes('Social Media')).join(' | ');
    }

    // 6. Social Links (Only 1 primary link per platform from the top header)
    const firstTable = doc.querySelector('table');
    const searchScope = firstTable ? Array.from(firstTable.querySelectorAll('a')) : Array.from(doc.querySelectorAll('a'));
    
    const platformsAdded = new Set();

    const addSocial = (platform, url, label) => {
      if (!platformsAdded.has(platform) && url) {
        platformsAdded.add(platform);
        info.socialMedia.push({ platform, url, label });
      }
    };

    // First scan header table links
    searchScope.forEach(a => {
      let href = a.getAttribute('href') || '';
      if (href.includes('google.com/url?q=')) {
        try {
          const u = new URL(href);
          href = u.searchParams.get('q') || href;
        } catch (e) {}
      }

      if (href.includes('facebook.com') && !href.includes('/share/')) {
        addSocial('Facebook', href, 'Facebook');
      } else if (href.includes('twitter.com') || href.includes('x.com')) {
        addSocial('Twitter', href, 'Twitter / X');
      } else if (href.includes('google.com/maps') || href.includes('maps.app.goo.gl')) {
        addSocial('Google Maps', href, 'Google Maps');
      } else if (href.includes('yell.com')) {
        addSocial('Yell', href, 'Yell Review Link');
      }
    });

    // If any platform wasn't found in the first table, fallback scan doc links ignoring review shares
    if (platformsAdded.size < 3) {
      const allDocLinks = Array.from(doc.querySelectorAll('a'));
      allDocLinks.forEach(a => {
        let href = a.getAttribute('href') || '';
        if (href.includes('google.com/url?q=')) {
          try {
            const u = new URL(href);
            href = u.searchParams.get('q') || href;
          } catch (e) {}
        }

        if (href.includes('facebook.com') && !href.includes('/share/p/')) {
          addSocial('Facebook', href, 'Facebook');
        } else if (href.includes('twitter.com') || href.includes('x.com')) {
          addSocial('Twitter', href, 'Twitter / X');
        } else if ((href.includes('google.com/maps') || href.includes('maps.app.goo.gl')) && !platformsAdded.has('Google Maps')) {
          addSocial('Google Maps', href, 'Google Maps');
        } else if (href.includes('yell.com') && !platformsAdded.has('Yell')) {
          addSocial('Yell', href, 'Yell Review Link');
        }
      });
    }

    return info;
  },

  /**
   * Slice Document by Page Tables and parse structured blocks
   */
  extractPagesFromDOM(doc) {
    const pages = [];
    const tables = Array.from(doc.querySelectorAll('table'));

    // Find all Page Header Tables (tables with Page Title / Meta Description / H1)
    const pageHeaderTables = [];

    tables.forEach((table, idx) => {
      const text = this.getCleanTextLines(table).join(' ');
      if (
        text.includes('Page Title') || 
        text.includes('Page/Meta Title') || 
        text.includes('Meta Description') || 
        text.includes('H1 (Hero image text)') ||
        text.includes('Our Services (Page') ||
        text.includes('Locations (Page') ||
        /\(Page \d+\)/i.test(text)
      ) {
        pageHeaderTables.push({ table, idx });
      }
    });

    if (pageHeaderTables.length === 0) {
      pages.push(this.parseSinglePageSection('Home', doc.body, 'home', 1));
      return pages;
    }

    for (let i = 0; i < pageHeaderTables.length; i++) {
      const current = pageHeaderTables[i];
      const next = pageHeaderTables[i + 1];

      // Parse metadata from table
      const headerMeta = this.parsePageHeaderTable(current.table);

      // Collect all sibling nodes between this table and the next page table
      const contentNodes = [];
      let sibling = current.table.nextSibling;
      const endTable = next ? next.table : null;

      while (sibling && sibling !== endTable) {
        contentNodes.push(sibling);
        sibling = sibling.nextSibling;
      }

      const page = this.parsePageFromDOMNodes(headerMeta.name, contentNodes, headerMeta.type, i + 1);
      
      page.metaTitle = headerMeta.metaTitle || page.metaTitle;
      page.metaDescription = headerMeta.metaDescription || page.metaDescription;
      if (headerMeta.h1) page.hero.h1 = headerMeta.h1;

      pages.push(page);
    }

    return pages;
  },

  parsePageHeaderTable(table) {
    const res = {
      name: 'Untitled Page',
      metaTitle: '',
      metaDescription: '',
      h1: '',
      type: 'generic'
    };

    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td, th'));
      if (tds.length >= 2) {
        const label = tds[0].textContent.trim();
        const val = tds[1].textContent.trim();
        if (/Page\/Meta Title|Page Title/i.test(label)) res.metaTitle = val;
        else if (/Meta Description/i.test(label)) res.metaDescription = val;
        else if (/H1/i.test(label)) res.h1 = val;
      } else if (tds.length === 1) {
        const text = tds[0].textContent.trim();
        if (text && !text.includes('Page Title') && !text.includes('Meta Description')) {
          res.name = text.replace(/\s*\(Page \d+\)/i, '').trim();
        }
      }
    });

    if (res.name === 'Untitled Page' && res.metaTitle) {
      res.name = res.metaTitle.split('|')[0].trim();
    }

    const lower = res.name.toLowerCase();
    if (lower.includes('home')) res.type = 'home';
    else if (lower.includes('service') || lower.includes('sweep') || lower.includes('repair') || lower.includes('test') || lower.includes('survey') || lower.includes('cowl') || lower.includes('nest')) res.type = 'service';
    else if (lower.includes('contact')) res.type = 'contact';
    else res.type = 'location';

    return res;
  },

  /**
   * Parse nodes belonging to one page into structured sections
   */
  parsePageFromDOMNodes(pageName, nodes, pageType, pageIndex) {
    const page = {
      id: this.slugify(pageName) + '-' + pageIndex,
      name: pageName,
      type: pageType || 'generic',
      pageIndex: pageIndex,
      metaTitle: '',
      metaDescription: '',
      hero: {
        h1: '',
        subtitle: '',
        buttonText: '',
        buttonLink: ''
      },
      propositions: {
        title: '',
        items: []
      },
      mainSection: {
        h2: '',
        paragraphs: []
      },
      services: [],
      bulletList: {
        title: '',
        items: []
      },
      faqs: [],
      testimonials: [],
      cta: {
        title: '',
        text: '',
        buttonText: '',
        buttonLink: ''
      },
      designerNotes: []
    };

    // Extract lines preserving distinct block boundaries
    const lines = [];
    nodes.forEach(node => {
      if (node.nodeType === 1) { // Element
        const tag = node.tagName.toLowerCase();
        if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'h1' || tag === 'h2' || tag === 'h3') {
          const t = node.textContent.trim();
          if (t) lines.push({ text: t, el: node, tag });
        } else if (tag === 'table') {
          // Process table (could be CTA or sub-table)
          const tableText = this.getCleanTextLines(node).join('\n');
          lines.push({ text: tableText, el: node, tag: 'table' });
        } else if (tag === 'ul' || tag === 'ol') {
          Array.from(node.querySelectorAll('li')).forEach(li => {
            const t = li.textContent.trim();
            if (t) lines.push({ text: t, el: li, tag: 'li' });
          });
        }
      }
    });

    let currentSection = 'HERO';
    let propTemp = null;
    let faqTemp = null;

    for (let i = 0; i < lines.length; i++) {
      const lineObj = lines[i];
      const line = lineObj.text;
      const lower = line.toLowerCase();

      // Check for CTA Table
      if (lineObj.tag === 'table' && line.includes('CTA')) {
        const titleM = line.match(/Title:\s*([^\n\r]+)/i);
        const textM = line.match(/Text:\s*([^\n\r]+)/i);
        const btnM = line.match(/Button:\s*([^>\n\r]+)(?:>\s*Link to\s*([^\n\r]*))?/i);
        if (titleM) page.cta.title = titleM[1].trim();
        if (textM) page.cta.text = textM[1].trim();
        if (btnM) {
          page.cta.buttonText = btnM[1].trim();
          page.cta.buttonLink = (btnM[2] || '').trim();
        }
        continue;
      }

      // Hero image button
      if (/Hero image button:/i.test(line)) {
        const m = line.match(/Hero image button:\s*([^>\n\r]+)(?:>\s*Link to\s*([^\n\r]*))?/i);
        if (m) {
          page.hero.buttonText = m[1].trim();
          page.hero.buttonLink = (m[2] || '').trim();
        }
        continue;
      }

      // Designer note
      if (/Note for the Designer:|Notes for Designer/i.test(line)) {
        currentSection = 'DESIGNER_NOTES';
        continue;
      }
      if (currentSection === 'DESIGNER_NOTES') {
        if (/Proposition|H2|How we help|Keep your chimney/i.test(line)) {
          // Switch out of designer notes
        } else {
          if (line.length > 3 && !line.includes('Hero image button')) {
            page.designerNotes.push(line);
          }
          continue;
        }
      }

      // Proposition Title
      if (/^Proposition Title$/i.test(line) || /^Proposition Title/i.test(line)) {
        currentSection = 'PROPOSITIONS';
        if (i + 1 < lines.length) {
          page.propositions.title = lines[i + 1].text.trim();
          i++; // Skip title value line
        }
        continue;
      }

      // Proposition 1, 2, 3
      const propMatch = line.match(/^Proposition\s*(\d+)/i);
      if (propMatch) {
        currentSection = 'PROPOSITIONS';
        const propNum = parseInt(propMatch[1], 10);
        let heading = '';
        let desc = '';

        // If heading is on same line (e.g. "Proposition 1: Heading")
        const inlineHead = line.replace(/^Proposition\s*\d+[:\s-]*/i, '').trim();
        if (inlineHead.length > 0) {
          heading = inlineHead;
          if (i + 1 < lines.length) {
            desc = lines[i + 1].text.trim();
            i++;
          }
        } else {
          // Heading on next line, description on following
          if (i + 1 < lines.length) heading = lines[i + 1].text.trim();
          if (i + 2 < lines.length) desc = lines[i + 2].text.trim();
          i += 2;
        }

        if (heading) {
          page.propositions.items.push({ num: propNum, heading, description: desc });
        }
        continue;
      }

      // Services Overview detection (Cards with Service Title, Summary, and Button Link)
      if (line.includes('> Relevant Service Page') || line.includes('> Link to Relevant Service Page') || (line.includes('Relevant Service Page') && line.includes('>'))) {
        currentSection = 'SERVICES';
        const srvBtnMatch = line.match(/(?:\[(.*?)\])?\s*>\s*(?:Link to\s*)?([^\n\r]*)/i);
        let btnText = srvBtnMatch && srvBtnMatch[1] ? srvBtnMatch[1].trim() : '';
        let btnLink = srvBtnMatch && srvBtnMatch[2] ? srvBtnMatch[2].trim() : 'Relevant Service Page';

        let srvDesc = '';
        let srvTitle = '';

        if (i - 1 >= 0) {
          srvDesc = lines[i - 1].text.trim();
        }
        if (i - 2 >= 0) {
          srvTitle = lines[i - 2].text.trim().replace(/^\[|\]$/g, '');
        }

        if (!btnText && srvTitle) {
          btnText = srvTitle;
        }

        // Section Title: if this is the first service item, look backwards before i - 2
        if (page.services.length === 0) {
          for (let s = i - 3; s >= 0; s--) {
            const prev = lines[s]?.text?.trim() || '';
            if (prev && prev !== page.mainSection.h2 && !prev.includes('Proposition') && !prev.includes('Hero') && !prev.startsWith('Since 2011') && prev.length < 140) {
              page.servicesTitle = prev;
              page.mainSection.paragraphs = page.mainSection.paragraphs.filter(p => p !== prev);
              break;
            }
          }
        }

        if (srvTitle && srvDesc) {
          // Remove from paragraphs if previously added
          page.mainSection.paragraphs = page.mainSection.paragraphs.filter(p => p !== srvTitle && p !== srvDesc && p !== line);
          
          page.services.push({
            title: srvTitle,
            description: srvDesc,
            buttonText: btnText || srvTitle,
            buttonLink: btnLink || `/${this.slugify(srvTitle)}`
          });
        }
        continue;
      }

      // H2 Main Section
      if (/^H2$/i.test(line)) {
        currentSection = 'H2_BODY';
        if (i + 1 < lines.length) {
          page.mainSection.h2 = lines[i + 1].text.trim();
          i++;
        }
        continue;
      }

      // FAQs detection
      if (line.includes('?') && (line.length < 150) && (
          /^How often|^Can |^Will |^Should |^Do |^What |^Why is|^Is it|^FAQs?\s*\d*/i.test(line)
      )) {
        currentSection = 'FAQS';
        const question = line.replace(/^FAQs?\s*\d*[:\s-]*/i, '').trim();
        let answer = '';
        if (i + 1 < lines.length) {
          answer = lines[i + 1].text.replace(/^Answer[:\s-]*/i, '').trim();
          i++;
        }
        page.faqs.push({ question, answer });
        continue;
      }

      // Bullet items
      if (lineObj.tag === 'li' || line.startsWith('•') || line.startsWith('-  ') || line.startsWith('- ') || line.startsWith('• ')) {
        const cleanBullet = line.replace(/^[-•*]\s*/, '').trim();
        if (cleanBullet.length > 5 && !cleanBullet.includes('Google') && !cleanBullet.includes('Facebook') && !cleanBullet.includes('Yell')) {
          // If bulletList title is not yet set, capture the immediately preceding heading line
          if (!page.bulletList.title) {
            for (let b = i - 1; b >= 0; b--) {
              const prev = lines[b]?.text?.trim() || '';
              if (prev && !prev.startsWith('•') && !prev.startsWith('-') && !prev.includes('>') && !prev.includes('Page Title') && prev.length < 120) {
                page.bulletList.title = prev;
                // Remove from paragraphs if it was added there
                page.mainSection.paragraphs = page.mainSection.paragraphs.filter(p => p !== prev);
                break;
              }
            }
          }
          page.bulletList.items.push(cleanBullet);
        }
        continue;
      }

      // Testimonials detection
      if (/Testimonials/i.test(line)) {
        currentSection = 'TESTIMONIALS';
        continue;
      }
      if (currentSection === 'TESTIMONIALS' && line.length > 15) {
        if (/Google|Facebook|Yell/i.test(line)) {
          const parts = line.split(',');
          const author = parts[0]?.trim() || 'Customer';
          const platform = parts[1]?.trim() || 'Google';
          // Find quote from previous line
          const quote = lines[i - 1]?.text || line;
          page.testimonials.push({ quote, author, platform });
        }
      }

      // Clean up and filter out junk template strings
      if (
        line.startsWith('Text > page') || 
        line.startsWith('Text  > page') || 
        line.includes('Capital Case > Link') || 
        line.includes('> Relevant Service Page') ||
        line === 'Text' || 
        line === 'page' ||
        line === 'Hero image text' ||
        line.startsWith('[Please refer to the form')
      ) {
        continue;
      }

      // Hero Subtitle fallback (ignoring template artifacts)
      if (!page.hero.subtitle && currentSection === 'HERO' && line.length > 15 && line.length < 250) {
        if (!line.includes('Page Title') && !line.includes('Meta Description') && !line.includes('Get In Touch') && !line.includes('Link to')) {
          page.hero.subtitle = line;
          continue;
        }
      }

      // Main Section Paragraphs fallback (sanitizing junk lines)
      if (currentSection === 'H2_BODY' && line.length > 20) {
        if (!line.includes('CTA') && !line.includes('Testimonials') && !line.includes('Button:') && !line.startsWith('Proposition')) {
          page.mainSection.paragraphs.push(line);
        }
      }
    }

    return page;
  },

  getCleanTextLines(element) {
    if (!element) return [];
    const lines = [];
    const elements = Array.from(element.querySelectorAll('p, li, h1, h2, h3, h4, td, th'));
    elements.forEach(el => {
      const t = el.textContent.trim();
      if (t && !lines.includes(t)) {
        lines.push(t);
      }
    });
    if (lines.length === 0 && element.textContent) {
      const fallback = element.textContent.trim();
      if (fallback) lines.push(fallback);
    }
    return lines;
  },

  parseJSON(json) {
    const rawPages = json.pages || (Array.isArray(json) ? json : [json]);
    const pages = [];
    const businessInfo = {
      companyName: '',
      phone: '',
      email: '',
      address: '',
      hours: '',
      socialMedia: []
    };

    rawPages.forEach((p, idx) => {
      const ai = p.AIContent || p;
      const meta = ai.meta_data || {};
      const pageData = p.PageData || {};

      const pageName = p.PageName || pageData.page_name || meta.heading?.split('|')[0]?.trim() || `Page ${idx + 1}`;
      const pageType = p.PageType || pageData.page_type || 'generic';

      const page = {
        id: this.slugify(pageName) + '-' + (idx + 1),
        name: pageName,
        type: pageType,
        pageIndex: idx + 1,
        metaTitle: meta.heading || '',
        metaDescription: meta.description || '',
        hero: {
          h1: ai.headline || '',
          subtitle: ai.subheadline || ai.website_conclusion || '',
          buttonText: ai.calltoaction || 'Get In Touch',
          buttonLink: '#contact'
        },
        propositions: {
          title: ai.proposition_title || "The difference you'll notice",
          items: []
        },
        mainSection: {
          h2: ai.section1?.heading || ai.section_title || '',
          paragraphs: [ai.section1?.description, ai.section2?.description, ai.section4?.description].filter(Boolean)
        },
        servicesTitle: ai.service_title || ai.services_title || '',
        services: [],
        bulletList: {
          title: 'Highlights',
          items: [ai.USP1, ai.USP2, ai.USP3].filter(Boolean)
        },
        faqs: [],
        testimonials: [],
        cta: {
          title: ai.CTA?.heading || 'Get In Touch',
          text: ai.CTA?.action || 'Call us today to book your visit.',
          buttonText: 'Contact Us',
          buttonLink: '01892 346007'
        },
        designerNotes: []
      };

      // Extract services in JSON
      for (let s = 1; s <= 12; s++) {
        const padKey = `service_${s < 10 ? '0' + s : s}`;
        const directKey = `service_${s}`;
        const unKey = `service${s}`;
        const srv = ai[padKey] || ai[directKey] || ai[unKey];
        if (srv && (srv.headline || srv.title)) {
          const srvTitle = (srv.headline || srv.title || '').trim();
          page.services.push({
            title: srvTitle,
            description: (srv.summary || srv.description || '').trim(),
            buttonText: (srv.button || srv.calltoaction || srvTitle).trim(),
            buttonLink: (srv.link || `/${this.slugify(srvTitle)}`).trim()
          });
        }
      }

      for (let i = 1; i <= 4; i++) {
        const prop = ai[`proposition_${i}`] || ai[`proposition${i}`];
        if (prop) {
          page.propositions.items.push({
            num: i,
            heading: prop.heading || `Point ${i}`,
            description: prop.description || ''
          });
        }
      }

      for (let i = 1; i <= 5; i++) {
        const faq = ai[`FAQs${i}`] || ai[`FAQ${i}`];
        if (faq && (faq.question || faq.q)) {
          page.faqs.push({
            question: faq.question || faq.q,
            answer: faq.answer || faq.a || ''
          });
        }
      }

      pages.push(page);
    });

    return {
      pages,
      businessInfo,
      source: 'json_package',
      parsedAt: new Date().toISOString()
    };
  },

  parseSummaryText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pages = [];
    const businessInfo = {
      companyName: '',
      phone: '',
      email: '',
      address: '',
      hours: '',
      socialMedia: []
    };

    let currentPage = null;
    let pageIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Page boundary
      if (line.startsWith('# ') || line.startsWith('Page:') || line.startsWith('Page Title:') || line.includes('(Page ')) {
        if (currentPage) pages.push(currentPage);
        const name = line.replace(/^[#\s]*Page[:\s]*|Page Title[:\s]*/i, '').replace(/\(Page \d+\)/i, '').trim() || `Page ${pageIndex}`;
        currentPage = {
          id: this.slugify(name) + '-' + pageIndex,
          name: name,
          type: name.toLowerCase().includes('home') ? 'home' : (name.toLowerCase().includes('contact') ? 'contact' : 'service'),
          pageIndex: pageIndex++,
          metaTitle: '',
          metaDescription: '',
          hero: { h1: '', subtitle: '', buttonText: 'Get In Touch', buttonLink: '#contact' },
          propositions: { title: '', items: [] },
          mainSection: { h2: '', paragraphs: [] },
          servicesTitle: '',
          services: [],
          bulletList: { title: 'Highlights', items: [] },
          faqs: [],
          testimonials: [],
          cta: { title: 'Get In Touch', text: 'Call today to book.', buttonText: 'Contact Us', buttonLink: '' },
          designerNotes: []
        };
        continue;
      }

      if (!currentPage) {
        currentPage = {
          id: 'home-1',
          name: 'Home',
          type: 'home',
          pageIndex: 1,
          metaTitle: '',
          metaDescription: '',
          hero: { h1: '', subtitle: '', buttonText: 'Get In Touch', buttonLink: '#contact' },
          propositions: { title: '', items: [] },
          mainSection: { h2: '', paragraphs: [] },
          servicesTitle: '',
          services: [],
          bulletList: { title: 'Highlights', items: [] },
          faqs: [],
          testimonials: [],
          cta: { title: 'Get In Touch', text: 'Call today to book.', buttonText: 'Contact Us', buttonLink: '' },
          designerNotes: []
        };
      }

      if (line.startsWith('H1:') || line.startsWith('H1 (Hero')) {
        currentPage.hero.h1 = line.replace(/^H1[^:]*:\s*/i, '').trim();
      } else if (line.startsWith('H2:')) {
        currentPage.mainSection.h2 = line.replace(/^H2:\s*/i, '').trim();
      } else if (line.startsWith('•') || line.startsWith('- ')) {
        currentPage.bulletList.items.push(line.replace(/^[-•]\s*/, '').trim());
      } else if (line.length > 25) {
        currentPage.mainSection.paragraphs.push(line);
      }
    }

    if (currentPage) pages.push(currentPage);

    return {
      pages,
      businessInfo,
      source: 'plain_text',
      parsedAt: new Date().toISOString()
    };
  },

  slugify(text) {
    return (text || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
};

if (typeof window !== 'undefined') {
  window.ContentParser = ContentParser;
}

export default ContentParser;
