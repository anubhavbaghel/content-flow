/**
 * =========================================================================
 * ContentFlow Application Controller
 * Live Google Doc Sync, Interactive 1-Click Copy, State & Change Tracking
 * =========================================================================
 */
import ContentParser from './parser.js';

class ContentFlowApp {
  constructor() {
    this.state = {
      project: null,
      activePageIndex: 0,
      copiedIds: new Set(),
      searchQuery: '',
      autoSyncTimer: null,
      autoSyncIntervalSec: 0,
      scriptUrl: localStorage.getItem('cf_script_url') || '',
      docUrl: localStorage.getItem('cf_doc_url') || '',
      theme: localStorage.getItem('cf_theme') || 'dark',
      copyMode: 'plain', // 'plain' or 'html'
      modifiedIds: new Set()
    };

    this.cardTextRegistry = new Map();
    this.init();
  }

  init() {
    // 1. Load saved theme
    document.documentElement.setAttribute('data-theme', this.state.theme);

    // 2. Load saved copied, modified items, and saved project
    try {
      const savedCopied = localStorage.getItem('cf_copied_ids');
      if (savedCopied) {
        this.state.copiedIds = new Set(JSON.parse(savedCopied));
      }
      const savedModified = localStorage.getItem('cf_modified_ids');
      if (savedModified) {
        this.state.modifiedIds = new Set(JSON.parse(savedModified));
      }
      const savedProject = localStorage.getItem('cf_saved_project');
      if (savedProject) {
        this.state.project = JSON.parse(savedProject);
      }
    } catch (e) {
      console.warn('Failed to load state', e);
    }

    // 3. Bind UI Events
    this.bindEvents();

    // 4. Populate saved inputs
    const docInput = document.getElementById('docUrlInput');
    if (docInput && this.state.docUrl) {
      docInput.value = this.state.docUrl;
    }

    const scriptInput = document.getElementById('scriptUrlInput');
    if (scriptInput && this.state.scriptUrl) {
      scriptInput.value = this.state.scriptUrl;
    }

    // 5. Render clean initial state (or restored project)
    this.render();
  }

  bindEvents() {
    // Sync Button
    document.getElementById('btnSync')?.addEventListener('click', () => this.syncLiveDoc());

    // Auto Sync Dropdown
    document.getElementById('autoSyncSelect')?.addEventListener('change', (e) => {
      this.setAutoSync(parseInt(e.target.value, 10));
    });

    // Doc URL Input (Enter key triggers sync)
    document.getElementById('docUrlInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.syncLiveDoc();
      }
    });

    // Search Input
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Settings Modal
    document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
      this.openModal('settingsModal');
    });

    // Save Settings
    document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Close Modal Buttons
    document.querySelectorAll('.btn-close-modal, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('btn-close-modal')) {
          this.closeAllModals();
        }
      });
    });

    // Smart Paste Button
    document.getElementById('btnSmartPaste')?.addEventListener('click', () => this.handleSmartPaste());

    // File Upload Input
    document.getElementById('fileUploadInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadFile(file);
    });

    // Global Keyboard Shortcuts (Ctrl+V smart paste)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        this.handleSmartPaste();
      }
    });

    // Clear Project / Reset Dashboard Button
    document.getElementById('btnClearProject')?.addEventListener('click', () => {
      this.clearProject();
    });

    // Reset Copied Progress for Active Page / Project
    document.getElementById('btnResetPageCopied')?.addEventListener('click', () => {
      this.resetCopiedProgress();
    });

    // Copy Entire Page as Markdown / Text
    document.getElementById('btnCopyAllPage')?.addEventListener('click', () => {
      this.copyEntireActivePage();
    });

    // Safe Event Delegation for Cards & Empty State Actions
    const pageCardsContainer = document.getElementById('pageCardsContainer');
    pageCardsContainer?.addEventListener('click', (e) => {
      // Empty state action buttons
      if (e.target.closest('#btnEmptyPaste')) {
        this.handleSmartPaste();
        return;
      }
      if (e.target.closest('#btnEmptyDemo')) {
        this.loadDemoData();
        return;
      }

      const card = e.target.closest('.copy-card, .bullet-item-card');
      if (!card) return;
      const elId = card.getAttribute('data-element-id');
      const item = this.cardTextRegistry.get(elId);
      if (item) {
        this.copyText(item.text, elId, item.label, e);
      }
    });

    // Empty state file upload listener
    pageCardsContainer?.addEventListener('change', (e) => {
      if (e.target.id === 'emptyFileInput' && e.target.files?.[0]) {
        this.loadFile(e.target.files[0]);
      }
    });

    pageCardsContainer?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.copy-card, .bullet-item-card');
        if (card) {
          e.preventDefault();
          const elId = card.getAttribute('data-element-id');
          const item = this.cardTextRegistry.get(elId);
          if (item) {
            this.copyText(item.text, elId, item.label, e);
          }
        }
      }
    });

    // Safe Event Delegation for Quick Business Chips
    const quickChipsContainer = document.getElementById('quickChipsContainer');
    quickChipsContainer?.addEventListener('click', (e) => {
      const chip = e.target.closest('.quick-chip');
      if (!chip) return;
      const elId = chip.getAttribute('data-element-id');
      const item = this.cardTextRegistry.get(elId);
      if (item) {
        this.copyText(item.text, elId, item.label, e);
      }
    });

    quickChipsContainer?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const chip = e.target.closest('.quick-chip');
        if (chip) {
          e.preventDefault();
          const elId = chip.getAttribute('data-element-id');
          const item = this.cardTextRegistry.get(elId);
          if (item) {
            this.copyText(item.text, elId, item.label, e);
          }
        }
      }
    });

    // Native Window Drag & Drop
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * Sync Live Doc via Method 1 (Google Apps Script Web App with JSONP fallback)
   */
  async syncLiveDoc() {
    const docUrl = document.getElementById('docUrlInput')?.value.trim();
    if (!docUrl) {
      this.showToast('Please enter a Google Doc URL', 'warning');
      return;
    }

    this.state.docUrl = docUrl;
    localStorage.setItem('cf_doc_url', docUrl);

    let scriptUrl = this.state.scriptUrl;
    if (!scriptUrl) {
      this.openModal('settingsModal');
      this.showToast('Please configure your Google Apps Script Web App URL first', 'info');
      return;
    }

    const btnSync = document.getElementById('btnSync');
    btnSync?.classList.add('syncing');

    try {
      this.showToast('Fetching latest changes from Google Doc...', 'info');

      // Use JSONP to guarantee no CORS or browser redirect blocking
      const data = await this.fetchViaJSONP(scriptUrl, docUrl);

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to fetch document from Google Apps Script');
      }

      // Parse the retrieved HTML
      const parsed = ContentParser.parse(data.html || data.plainText);
      this.updateProjectWithDiff(parsed, data.title || 'Synced Google Doc');

      this.showToast(`✅ Synced with Google Doc (${data.title || 'Live'})`, 'success');
      document.getElementById('lastSyncLabel').textContent = `Synced: ${new Date().toLocaleTimeString()}`;

    } catch (err) {
      console.error('Live sync error:', err);
      this.showToast(`Sync error: ${err.message}. Check Apps Script permissions or URL.`, 'warning');
    } finally {
      btnSync?.classList.remove('syncing');
    }
  }

  /**
   * Fetch data using JSONP to eliminate all CORS & 302 redirect issues
   */
  fetchViaJSONP(scriptUrl, docUrl) {
    return new Promise((resolve, reject) => {
      const callbackName = 'cf_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      const url = `${scriptUrl}?docUrl=${encodeURIComponent(docUrl)}&callback=${callbackName}`;

      const script = document.createElement('script');
      script.src = url;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out. Please verify your Google Apps Script URL.'));
      }, 15000);

      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
        clearTimeout(timeout);
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Network error loading Google Apps Script. Ensure deployment is set to "Who has access: Anyone"'));
      };

      document.body.appendChild(script);
    });
  }

  /**
   * Set Auto-polling interval
   */
  setAutoSync(seconds) {
    if (this.state.autoSyncTimer) {
      clearInterval(this.state.autoSyncTimer);
      this.state.autoSyncTimer = null;
    }

    this.state.autoSyncIntervalSec = seconds;

    if (seconds > 0) {
      this.state.autoSyncTimer = setInterval(() => {
        if (this.state.docUrl && this.state.scriptUrl) {
          this.syncLiveDoc();
        }
      }, seconds * 1000);
      this.showToast(`Auto-sync active (every ${seconds}s)`, 'info');
    } else {
      this.showToast('Auto-sync disabled', 'info');
    }
  }

  /**
   * Updates project data and detects modified fields for live diff tracking
   */
  updateProjectWithDiff(newProject, projectName) {
    const oldPages = this.state.project ? this.state.project.pages : [];
    let revisedCopiedCount = 0;
    let newModifiedCount = 0;

    if (oldPages.length > 0) {
      newProject.pages.forEach((newPage, pIdx) => {
        const oldPage = oldPages.find(p => p.id === newPage.id) || oldPages[pIdx];
        if (oldPage) {
          const markChanged = (elId, isDiff) => {
            if (isDiff) {
              this.state.modifiedIds.add(elId);
              newModifiedCount++;
              // If it was already copied before, un-copy it so developer knows to re-copy
              if (this.state.copiedIds.has(elId)) {
                this.state.copiedIds.delete(elId);
                revisedCopiedCount++;
              }
            }
          };

          // Meta
          markChanged(`${newPage.id}-meta-title`, newPage.metaTitle !== oldPage.metaTitle);
          markChanged(`${newPage.id}-meta-desc`, newPage.metaDescription !== oldPage.metaDescription);

          // Hero
          markChanged(`${newPage.id}-hero-h1`, newPage.hero?.h1 !== oldPage.hero?.h1);
          markChanged(`${newPage.id}-hero-sub`, newPage.hero?.subtitle !== oldPage.hero?.subtitle);
          markChanged(`${newPage.id}-hero-btn`, newPage.hero?.buttonText !== oldPage.hero?.buttonText);
          markChanged(`${newPage.id}-hero-link`, newPage.hero?.buttonLink !== oldPage.hero?.buttonLink);

          // Propositions
          markChanged(`${newPage.id}-prop-title`, newPage.propositions?.title !== oldPage.propositions?.title);
          (newPage.propositions?.items || []).forEach((prop, idx) => {
            const oldProp = (oldPage.propositions?.items || [])[idx];
            markChanged(`${newPage.id}-prop-${idx}-head`, !oldProp || prop.heading !== oldProp.heading);
            markChanged(`${newPage.id}-prop-${idx}-desc`, !oldProp || prop.description !== oldProp.description);
          });

          // Main Section (H2 & Paragraphs)
          markChanged(`${newPage.id}-main-h2`, newPage.mainSection?.h2 !== oldPage.mainSection?.h2);
          (newPage.mainSection?.paragraphs || []).forEach((p, idx) => {
            const oldP = (oldPage.mainSection?.paragraphs || [])[idx];
            markChanged(`${newPage.id}-main-p-${idx}`, !oldP || p !== oldP);
          });

          // Bullets
          const newBulletsStr = (newPage.bulletList?.items || []).join('\n');
          const oldBulletsStr = (oldPage.bulletList?.items || []).join('\n');
          markChanged(`${newPage.id}-bullets-all`, newBulletsStr !== oldBulletsStr);
          markChanged(`${newPage.id}-bullet-heading`, newPage.bulletList?.title !== oldPage.bulletList?.title);

          // FAQs
          (newPage.faqs || []).forEach((faq, fIdx) => {
            const oldFaq = (oldPage.faqs || [])[fIdx];
            markChanged(`${newPage.id}-faq-${fIdx}-q`, !oldFaq || faq.question !== oldFaq.question);
            markChanged(`${newPage.id}-faq-${fIdx}-ans`, !oldFaq || faq.answer !== oldFaq.answer);
          });

          // Services Section
          markChanged(`${newPage.id}-services-title`, newPage.servicesTitle !== oldPage.servicesTitle);
          (newPage.services || []).forEach((srv, sIdx) => {
            const oldSrv = (oldPage.services || [])[sIdx];
            markChanged(`${newPage.id}-srv-${sIdx}-title`, !oldSrv || srv.title !== oldSrv.title);
            markChanged(`${newPage.id}-srv-${sIdx}-desc`, !oldSrv || srv.description !== oldSrv.description);
            markChanged(`${newPage.id}-srv-${sIdx}-btn`, !oldSrv || srv.buttonText !== oldSrv.buttonText);
            markChanged(`${newPage.id}-srv-${sIdx}-link`, !oldSrv || srv.buttonLink !== oldSrv.buttonLink);
          });

          // CTA
          markChanged(`${newPage.id}-cta-title`, newPage.cta?.title !== oldPage.cta?.title);
          markChanged(`${newPage.id}-cta-text`, newPage.cta?.text !== oldPage.cta?.text);
          markChanged(`${newPage.id}-cta-btn`, newPage.cta?.buttonText !== oldPage.cta?.buttonText);
          markChanged(`${newPage.id}-cta-link`, newPage.cta?.buttonLink !== oldPage.cta?.buttonLink);
        }
      });
    }

    this.state.project = newProject;
    this.state.projectName = projectName || newProject.businessInfo?.companyName || 'Website Project';

    // Safely bound activePageIndex
    if (!newProject.pages || newProject.pages.length === 0) {
      this.state.activePageIndex = 0;
    } else if (this.state.activePageIndex >= newProject.pages.length) {
      this.state.activePageIndex = 0;
    }
    
    this.saveModifiedState();
    this.saveCopiedState();

    try {
      localStorage.setItem('cf_saved_project', JSON.stringify(newProject));
    } catch (e) {
      console.warn('Could not persist project to localStorage', e);
    }

    if (revisedCopiedCount > 0) {
      this.showToast(`Updated: ${revisedCopiedCount} previously copied item(s) modified in Google Doc`, 'warning');
    } else if (newModifiedCount > 0) {
      this.showToast(`${newModifiedCount} element(s) updated from Google Doc`, 'info');
    }

    this.render();
  }

  /**
   * 1-Click Clipboard Copy Handler
   */
  async copyText(text, elementId, label, e) {
    if (e) e.stopPropagation();
    if (!text) return;

    const cleanText = text.trim();

    try {
      await navigator.clipboard.writeText(cleanText);

      // Track as copied and remove from modified
      this.state.copiedIds.add(elementId);
      this.state.modifiedIds.delete(elementId);
      this.saveCopiedState();
      this.saveModifiedState();

      // Visual feedback
      const cardEl = document.querySelector(`[data-element-id="${elementId}"]`);
      if (cardEl) {
        cardEl.classList.add('copied');
        cardEl.classList.remove('updated-modified');
      }

      this.updateProgressMeter();
      this.showToast(`Copied ${label || 'text'}`);

    } catch (err) {
      console.error('Clipboard copy failed', err);
      const ta = document.createElement('textarea');
      ta.value = cleanText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);

      this.state.copiedIds.add(elementId);
      this.state.modifiedIds.delete(elementId);
      this.saveCopiedState();
      this.saveModifiedState();
      this.updateProgressMeter();
      this.showToast(`Copied ${label || 'text'}`);
    }
  }

  /**
   * Toggle Copied state manually
   */
  toggleCopiedState(elementId, e) {
    if (e) e.stopPropagation();
    if (this.state.copiedIds.has(elementId)) {
      this.state.copiedIds.delete(elementId);
    } else {
      this.state.copiedIds.add(elementId);
      this.state.modifiedIds.delete(elementId);
    }
    this.saveCopiedState();
    this.saveModifiedState();
    this.render();
  }

  saveCopiedState() {
    localStorage.setItem('cf_copied_ids', JSON.stringify(Array.from(this.state.copiedIds)));
  }

  saveModifiedState() {
    localStorage.setItem('cf_modified_ids', JSON.stringify(Array.from(this.state.modifiedIds)));
  }

  /**
   * Copy All Bullets in Section
   */
  copyAllBullets(bullets, pageId) {
    if (!bullets || bullets.length === 0) return;
    const text = bullets.map(b => `• ${b}`).join('\n');
    this.copyText(text, `${pageId}-bullets-all`, 'All Bullet Points');
  }

  /**
   * Copy All FAQs in Section
   */
  copyAllFAQs(faqs, pageId) {
    if (!faqs || faqs.length === 0) return;
    const text = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}\n`).join('\n');
    this.copyText(text, `${pageId}-faqs-all`, 'All FAQs');
  }

  /**
   * Copy Entire Active Page Copy
   */
  copyEntireActivePage() {
    const page = this.getActivePage();
    if (!page) return;

    let output = `# ${page.name}\n\n`;
    if (page.metaTitle) output += `**Page Title:** ${page.metaTitle}\n`;
    if (page.metaDescription) output += `**Meta Description:** ${page.metaDescription}\n\n`;
    if (page.hero?.h1) output += `## H1: ${page.hero.h1}\n`;
    if (page.hero?.subtitle) output += `${page.hero.subtitle}\n\n`;

    if (page.propositions?.items?.length) {
      output += `### Value Propositions\n`;
      page.propositions.items.forEach(p => {
        output += `* **${p.heading}**: ${p.description}\n`;
      });
      output += '\n';
    }

    if (page.mainSection?.h2) {
      output += `## ${page.mainSection.h2}\n`;
      page.mainSection.paragraphs.forEach(p => {
        output += `${p}\n\n`;
      });
    }

    if (page.services?.length) {
      output += `### ${page.servicesTitle || 'Services'}\n`;
      page.services.forEach((s, idx) => {
        output += `#### ${s.title}\n${s.description}\nButton: ${s.buttonText} (${s.buttonLink})\n\n`;
      });
    }

    if (page.bulletList?.items?.length) {
      output += `### Highlights\n`;
      page.bulletList.items.forEach(b => {
        output += `* ${b}\n`;
      });
      output += '\n';
    }

    if (page.faqs?.length) {
      output += `### FAQs\n`;
      page.faqs.forEach(f => {
        output += `**Q: ${f.question}**\n${f.answer}\n\n`;
      });
    }

    if (page.cta?.title) {
      output += `### Call To Action\n**${page.cta.title}**\n${page.cta.text}\nButton: ${page.cta.buttonText} (${page.cta.buttonLink})\n\n`;
    }

    this.copyText(output, `${page.id}-page-full`, `${page.name} Full Copy`);
  }

  /**
   * Reset the entire dashboard and unload the document
   */
  clearProject() {
    if (!this.state.project) {
      this.showToast('Workspace is already empty', 'info');
      return;
    }

    this.state.project = null;
    this.state.activePageIndex = 0;
    this.state.copiedIds.clear();
    this.state.modifiedIds.clear();
    this.state.searchQuery = '';
    this.cardTextRegistry.clear();

    localStorage.removeItem('cf_saved_project');
    localStorage.removeItem('cf_copied_ids');
    localStorage.removeItem('cf_modified_ids');

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const lastSyncLabel = document.getElementById('lastSyncLabel');
    if (lastSyncLabel) lastSyncLabel.textContent = 'Ready';

    this.render();
    this.showToast('Workspace cleared. Default state restored.', 'info');
  }

  /**
   * Reset copied state for current page or all pages
   */
  resetCopiedProgress() {
    if (!this.state.project) {
      this.showToast('No document loaded', 'info');
      return;
    }

    const page = this.getActivePage();
    const prefix = page ? (page.id + '-') : '';
    let removedOnPage = 0;

    Array.from(this.state.copiedIds).forEach(id => {
      if (prefix && id.startsWith(prefix)) {
        this.state.copiedIds.delete(id);
        removedOnPage++;
      }
    });

    if (removedOnPage > 0) {
      this.saveCopiedState();
      this.render();
      this.showToast(`Reset copy progress for ${page.name} (${removedOnPage} item${removedOnPage > 1 ? 's' : ''})`, 'info');
      return;
    }

    // If active page had 0 copied items, but other pages have copied items, reset all!
    if (this.state.copiedIds.size > 0) {
      const total = this.state.copiedIds.size;
      this.state.copiedIds.clear();
      this.saveCopiedState();
      this.render();
      this.showToast(`Reset all copy progress across the project (${total} item${total > 1 ? 's' : ''})`, 'info');
      return;
    }

    // If nothing was copied anywhere
    this.showToast('Copy progress is already 0. To unload the document, click "Clear" in the top bar.', 'info');
  }

  /**
   * Smart Paste handler
   */
  async handleSmartPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.length < 10) {
        this.showToast('Clipboard is empty or text too short', 'warning');
        return;
      }

      const parsed = ContentParser.parse(text);
      if (parsed.pages.length === 0 && !parsed.businessInfo?.companyName) {
        this.showToast('Could not recognize structured content from clipboard', 'warning');
        return;
      }

      this.updateProjectWithDiff(parsed, 'Pasted Document');
      this.showToast(`Parsed ${parsed.pages.length} pages from clipboard`, 'success');

    } catch (err) {
      console.warn('Clipboard read error, opening manual paste modal', err);
      const manualText = prompt('Paste your Google Doc HTML / JSON / text here:');
      if (manualText) {
        const parsed = ContentParser.parse(manualText);
        this.updateProjectWithDiff(parsed, 'Pasted Document');
        this.showToast(`Parsed ${parsed.pages.length} pages`, 'success');
      }
    }
  }

  /**
   * Load local file (.docx, .html, .json, .txt)
   */
  async loadFile(file) {
    if (!file) return;

    // Word Document (.docx) parsing using Mammoth.js
    if (file.name.toLowerCase().endsWith('.docx')) {
      const mammothLib = typeof mammoth !== 'undefined' ? mammoth : (window.mammoth || null);
      if (!mammothLib) {
        this.showToast('mammoth.js is loading. Please try again or use .html / .json / .txt', 'warning');
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammothLib.convertToHtml({ arrayBuffer });
        const html = result.value;
        const parsed = ContentParser.parse(html);
        this.updateProjectWithDiff(parsed, file.name);
        this.showToast(`Loaded ${file.name} (${parsed.pages.length} pages)`, 'success');
      } catch (err) {
        console.error('Failed to parse .docx file', err);
        this.showToast(`Error reading .docx file: ${err.message}`, 'warning');
      }
      return;
    }

    // Standard Text / HTML / JSON reading
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsed = ContentParser.parse(content);
        this.updateProjectWithDiff(parsed, file.name);
        this.showToast(`Loaded ${file.name} (${parsed.pages.length} pages)`, 'success');
      } catch (err) {
        console.error('File parsing error', err);
        this.showToast(`Error parsing file: ${err.message}`, 'warning');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Load Preloaded Workspace Demo Data
   */
  async loadDemoData() {
    // Embedded demo data for instant readiness
    const demo = {
      pages: [
        {
          id: 'home-1',
          name: 'Home',
          type: 'home',
          pageIndex: 1,
          metaTitle: 'Chimney Services | Tunbridge Wells | The Southborough Sweep',
          metaDescription: 'Chimney services in Tunbridge Wells from The Southborough Sweep. HETAS-approved care, repairs and inspections for safer use.',
          hero: {
            h1: 'Chimney services in Tunbridge Wells by HETAS-approved sweeps',
            subtitle: 'Since 2011. Thorough fault finding. Friendly service throughout.',
            buttonText: 'Get In Touch',
            buttonLink: 'tel:+441892346007'
          },
          propositions: {
            title: "The difference you'll notice from the start",
            items: [
              { num: 1, heading: 'We look beyond the obvious', description: 'A sweep is not just about clearing soot. We keep an eye out for faults, wear and airflow problems.' },
              { num: 2, heading: 'Practical help for older chimneys', description: 'Age, weather and regular use all take their toll. We help you understand what needs attention now.' },
              { num: 3, heading: 'Cleaner work around your home', description: 'Chimney care can be messy if rushed. We work carefully to keep disruption down.' }
            ]
          },
          mainSection: {
            h2: 'Chimney care that solves problems early',
            paragraphs: [
              "Cold evenings are a lot nicer when your fire works properly, and your chimney is safe to use. The Southborough Sweep has been helping households since 2011, providing straightforward chimney care shaped by our experience across Tunbridge Wells, Rusthall, Tonbridge, and Pembury."
            ]
          },
          servicesTitle: 'How we help keep your chimney safe and working properly',
          services: [
            { title: 'Chimney Sweeping', description: 'We clear soot and creosote buildup to help your fire burn better, and your chimney work more safely.', buttonText: 'Chimney Sweeping', buttonLink: '/chimney-sweeping' },
            { title: 'Chimney Repairs', description: 'We address chimney damage before it becomes a bigger, more expensive headache.', buttonText: 'Chimney Repairs', buttonLink: '/chimney-repairs' },
            { title: 'Smoke Tests', description: 'We check that smoke travels where it should and does not escape into your home.', buttonText: 'Smoke Tests', buttonLink: '/smoke-tests' },
            { title: 'CCTV Chimney Surveys', description: 'We inspect the inside of your flue with camera equipment to find cracks and blockages.', buttonText: 'CCTV Chimney Surveys', buttonLink: '/cctv-surveys' }
          ],
          bulletList: {
            title: 'Why choose us for chimney care?',
            items: [
              'HETAS-approved chimney sweep',
              'Established since 2011',
              'Safer fires and cleaner flues',
              'Helpful checks for hidden faults',
              'Straight-talking local service'
            ]
          },
          faqs: [],
          testimonials: [],
          cta: {
            title: 'Want a safer chimney at home?',
            text: 'Call The Southborough Sweep today to book your visit.',
            buttonText: 'Find Out More',
            buttonLink: 'tel:+441892346007'
          },
          designerNotes: []
        }
      ],
      businessInfo: {
        companyName: 'The Southborough Sweep',
        phone: '01892 346007',
        phoneButton: 'Call: 01892 346007',
        phoneLink: '+441892346007',
        phoneTelUri: 'tel:+441892346007',
        email: 'alex@thesouthboroughsweep.co.uk',
        address: '37 Chestnut Avenue, Southborough, Tunbridge Wells, TN4 0BT',
        hours: 'Monday – Saturday: 08:00 - 18:00 | Sunday: Closed',
        socialMedia: [
          { platform: 'Facebook', url: 'https://www.facebook.com/AlexTheSouthboroughSweep/', label: 'Facebook' },
          { platform: 'Google Maps', url: 'https://maps.app.goo.gl/gAq9vFtLiDTobfHD9', label: 'Google Maps' }
        ]
      }
    };
    this.updateProjectWithDiff(demo, 'Sample Project (Offline Fallback)');
  }

  /**
   * Theme Switcher
   */
  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.state.theme);
    localStorage.setItem('cf_theme', this.state.theme);
    const icon = document.querySelector('#btnThemeToggle .theme-icon');
    if (icon) icon.textContent = this.state.theme === 'dark' ? '☀️' : '🌙';
  }

  /**
   * Modal Management
   */
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  saveSettings() {
    const scriptInput = document.getElementById('scriptUrlInput');
    if (scriptInput) {
      this.state.scriptUrl = scriptInput.value.trim();
      localStorage.setItem('cf_script_url', this.state.scriptUrl);
    }
    this.closeAllModals();
    this.showToast('Settings saved!', 'success');
  }

  /**
   * Floating Toast Notifications
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /**
   * Get Active Page Object
   */
  getActivePage() {
    if (!this.state.project || !this.state.project.pages || this.state.project.pages.length === 0) {
      return null;
    }
    return this.state.project.pages[this.state.activePageIndex] || this.state.project.pages[0];
  }

  /**
   * Main Render Function
   */
  render() {
    this.renderSidebar();
    this.renderMainWorkspace();
    this.renderQuickBusinessDrawer();
    this.updateProgressMeter();
  }

  /**
   * Render Sidebar with categorized page navigation
   */
  renderSidebar() {
    const container = document.getElementById('sidebarNavContainer');
    if (!container) return;

    if (!this.state.project || !this.state.project.pages || this.state.project.pages.length === 0) {
      container.innerHTML = `
        <div class="sidebar-empty-state">
          <div class="sidebar-empty-title">0 Pages Loaded</div>
          <p class="sidebar-empty-text">Pages will appear here once you paste or drop a document.</p>
        </div>
      `;
      return;
    }

    const pages = this.state.project.pages;
    const query = this.state.searchQuery;

    // Categorize pages
    const mainPages = [];
    const servicePages = [];
    const locationPages = [];

    pages.forEach((p, idx) => {
      // Filter by search query
      if (query && !p.name.toLowerCase().includes(query) && !p.metaTitle.toLowerCase().includes(query) && !p.hero?.h1?.toLowerCase().includes(query)) {
        return;
      }

      const item = { page: p, index: idx };
      if (p.type === 'home' || p.type === 'contact') {
        mainPages.push(item);
      } else if (p.type === 'service') {
        servicePages.push(item);
      } else {
        locationPages.push(item);
      }
    });

    let html = '';

    if (mainPages.length > 0) {
      html += `<div class="nav-group-title">Main Pages</div>`;
      mainPages.forEach(item => {
        html += this.renderPageNavItem(item.page, item.index);
      });
    }

    if (servicePages.length > 0) {
      html += `<div class="nav-group-title">Services (${servicePages.length})</div>`;
      servicePages.forEach(item => {
        html += this.renderPageNavItem(item.page, item.index);
      });
    }

    if (locationPages.length > 0) {
      html += `<div class="nav-group-title">Locations (${locationPages.length})</div>`;
      locationPages.forEach(item => {
        html += this.renderPageNavItem(item.page, item.index);
      });
    }

    container.innerHTML = html;

    // Add click listeners to nav items
    container.querySelectorAll('.page-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        this.state.activePageIndex = idx;
        this.render();
      });
    });
  }

  renderPageNavItem(page, index) {
    const isActive = index === this.state.activePageIndex;
    const copiedCount = this.getPageCopiedCount(page);

    return `
      <div class="page-nav-item ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="page-label">
          <span>${this.escapeHTML(page.name)}</span>
        </div>
        <div class="page-badge">${copiedCount}</div>
      </div>
    `;
  }

  getPageCopiedCount(page) {
    if (!page) return '';
    const prefix = page.id + '-';
    let count = 0;
    this.state.copiedIds.forEach(id => {
      if (id.startsWith(prefix)) count++;
    });
    return count > 0 ? `${count}` : '';
  }

  /**
   * Render Main Workspace with Cards
   */
  renderMainWorkspace() {
    const container = document.getElementById('pageCardsContainer');
    const headerTitle = document.getElementById('activePageTitle');
    const pageTypeTag = document.getElementById('activePageTypeTag');
    const pageSubtitle = document.getElementById('activePageSubtitle');

    if (!container) return;

    const page = this.getActivePage();
    const btnReset = document.getElementById('btnResetPageCopied');
    const btnCopyAll = document.getElementById('btnCopyAllPage');

    if (!page) {
      if (headerTitle) headerTitle.textContent = 'Workspace Ready';
      if (pageTypeTag) pageTypeTag.textContent = 'No Document';
      if (pageSubtitle) pageSubtitle.textContent = 'Paste or drop content to begin extracting 1-click copy elements';

      if (btnReset) btnReset.disabled = true;
      if (btnCopyAll) btnCopyAll.disabled = true;

      container.innerHTML = `
        <div class="empty-state-view">
          <div class="empty-badge">Ready for Input</div>
          <h2 class="empty-title">No Document Loaded</h2>
          <p class="empty-subtitle">
            Paste your Google Doc with <kbd>Ctrl+V</kbd> or drop a file anywhere to generate interactive 1-click copy cards.
          </p>
          <div class="empty-actions-row">
            <button id="btnEmptyPaste" class="btn-action btn-primary" type="button">
              Paste from Clipboard (Ctrl+V)
            </button>
            <label class="btn-action" style="cursor: pointer;">
              Drop File
              <input type="file" id="emptyFileInput" accept=".html,.json,.txt,.docx" style="display: none;">
            </label>
            <button id="btnEmptyDemo" class="btn-action" type="button">
              Explore Sample Project
            </button>
          </div>
          <div class="empty-features-grid">
            <div class="empty-feature-card">
              <div class="feature-title">1-Click Instant Copy</div>
              <div class="feature-desc">Headlines, paragraphs, links, and bullet points copied to clipboard in 1 click.</div>
            </div>
            <div class="empty-feature-card">
              <div class="feature-title">Smart Categorization</div>
              <div class="feature-desc">Automatically sorts Main Pages, Services, and Regional Locations.</div>
            </div>
            <div class="empty-feature-card">
              <div class="feature-title">Quick Business Drawer</div>
              <div class="feature-desc">1-click access to company phone, click-to-dial links, email, and socials.</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (btnReset) btnReset.disabled = false;
    if (btnCopyAll) btnCopyAll.disabled = false;

    if (headerTitle) headerTitle.textContent = page.name;
    if (pageTypeTag) pageTypeTag.textContent = page.type;
    if (pageSubtitle) pageSubtitle.textContent = page.metaTitle || `${page.name} Website Copy`;

    this.cardTextRegistry.clear();
    let html = '';

    // 1. SEO & Meta Block
    if (page.metaTitle || page.metaDescription) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>SEO & Metadata</h3>
            <span class="badge-version">Search Engine</span>
          </div>
          <div class="section-block-body">
            ${page.metaTitle ? this.renderCopyCard(page.metaTitle, `${page.id}-meta-title`, 'Page Title / Meta Title', 'Title') : ''}
            ${page.metaDescription ? this.renderCopyCard(page.metaDescription, `${page.id}-meta-desc`, 'Meta Description', 'Description') : ''}
          </div>
        </div>
      `;
    }

    // 2. Hero Section Block
    if (page.hero?.h1 || page.hero?.subtitle || page.hero?.buttonText) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Hero Section</h3>
            <span class="badge-version">Hero</span>
          </div>
          <div class="section-block-body">
            ${page.hero.h1 ? this.renderCopyCard(page.hero.h1, `${page.id}-hero-h1`, 'H1 Heading', 'H1') : ''}
            ${page.hero.subtitle ? this.renderCopyCard(page.hero.subtitle, `${page.id}-hero-sub`, 'Hero Subtitle / Summary', 'Subtitle') : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${page.hero.buttonText ? this.renderCopyCard(page.hero.buttonText, `${page.id}-hero-btn`, 'Button Label', 'Button') : ''}
              ${page.hero.buttonLink ? this.renderCopyCard(page.hero.buttonLink, `${page.id}-hero-link`, 'Button Link Target', 'Link') : ''}
            </div>
          </div>
        </div>
      `;
    }

    // 3. Value Propositions Block
    if (page.propositions?.items?.length > 0) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Value Propositions</h3>
            <span class="badge-version">${page.propositions.title || 'Propositions'}</span>
          </div>
          <div class="section-block-body">
            ${page.propositions.title ? this.renderCopyCard(page.propositions.title, `${page.id}-prop-title`, 'Section Proposition Title', 'Title') : ''}
            <div class="props-grid">
              ${page.propositions.items.map((prop, idx) => `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${this.renderCopyCard(prop.heading, `${page.id}-prop-${idx}-head`, `Point ${prop.num || idx+1} Heading`, 'Heading')}
                  ${this.renderCopyCard(prop.description, `${page.id}-prop-${idx}-desc`, `Point ${prop.num || idx+1} Description`, 'Body')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // 4. Main Section (H2)
    if (page.mainSection?.h2 || (page.mainSection?.paragraphs && page.mainSection.paragraphs.length > 0)) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Main Section (H2)</h3>
            <span class="badge-version">Body</span>
          </div>
          <div class="section-block-body">
            ${page.mainSection.h2 ? this.renderCopyCard(page.mainSection.h2, `${page.id}-main-h2`, 'H2 Heading', 'H2') : ''}
            ${(page.mainSection.paragraphs || []).map((p, idx) => 
              this.renderCopyCard(p, `${page.id}-main-p-${idx}`, `Paragraph ${idx + 1}`, 'Text')
            ).join('')}
          </div>
        </div>
      `;
    }

    // 5. Services Overview Block (e.g. on Home page)
    if (page.services && page.services.length > 0) {
      const servicesSectionHeading = page.servicesTitle || 'Overview of Services';
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>${this.escapeHTML(servicesSectionHeading)} (${page.services.length})</h3>
            <span class="badge-version">Services</span>
          </div>
          <div class="section-block-body">
            ${page.servicesTitle ? this.renderCopyCard(page.servicesTitle, `${page.id}-services-title`, 'Section Title', 'Heading') : ''}
            <div class="services-grid">
              ${page.services.map((srv, idx) => `
                <div class="service-card-group">
                  ${this.renderCopyCard(srv.title, `${page.id}-srv-${idx}-title`, `Service ${idx + 1}: Title`, 'Title')}
                  ${this.renderCopyCard(srv.description, `${page.id}-srv-${idx}-desc`, `Service ${idx + 1}: Description`, 'Description')}
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    ${this.renderCopyCard(srv.buttonText, `${page.id}-srv-${idx}-btn`, `Service ${idx + 1}: Button`, 'Button')}
                    ${this.renderCopyCard(srv.buttonLink, `${page.id}-srv-${idx}-link`, `Service ${idx + 1}: Link`, 'Link')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // 6. Bullet Highlights
    if (page.bulletList?.items?.length > 0) {
      const listTitle = page.bulletList.title || 'Highlights';
      const allBulletsText = page.bulletList.items.map(b => `• ${b}`).join('\n');

      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>${this.escapeHTML(listTitle)} (${page.bulletList.items.length})</h3>
          </div>
          <div class="section-block-body">
            ${page.bulletList.title ? this.renderCopyCard(page.bulletList.title, `${page.id}-bullet-heading`, 'Section Heading', 'Heading') : ''}
            ${this.renderCopyCard(allBulletsText, `${page.id}-bullets-all`, `Bullet Points (${page.bulletList.items.length})`, 'Copy All')}
          </div>
        </div>
      `;
    }

    // 6. FAQs Section
    if (page.faqs?.length > 0) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Frequently Asked Questions (${page.faqs.length})</h3>
            <button class="btn-action" onclick="app.copyAllFAQs(app.getActivePage().faqs, '${page.id}')">Copy All</button>
          </div>
          <div class="section-block-body">
            ${page.faqs.map((faq, idx) => `
              <div class="faq-block">
                ${this.renderCopyCard(faq.question, `${page.id}-faq-${idx}-q`, `Q${idx+1}: Question`, 'Q')}
                ${this.renderCopyCard(faq.answer, `${page.id}-faq-${idx}-ans`, `A${idx+1}: Answer`, 'A')}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 7. Testimonials
    if (page.testimonials?.length > 0) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Testimonials</h3>
            <span class="badge-version">Social Proof</span>
          </div>
          <div class="section-block-body">
            ${page.testimonials.map((t, idx) => `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${this.renderCopyCard(t.quote, `${page.id}-test-${idx}-quote`, `Quote (${t.author}, ${t.platform})`, 'Review')}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  ${this.renderCopyCard(t.author, `${page.id}-test-${idx}-author`, 'Author', 'Name')}
                  ${this.renderCopyCard(t.platform, `${page.id}-test-${idx}-plat`, 'Source', 'Platform')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 8. Call To Action (CTA)
    if (page.cta?.title || page.cta?.text) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Call To Action</h3>
            <span class="badge-version">CTA</span>
          </div>
          <div class="section-block-body">
            ${page.cta.title ? this.renderCopyCard(page.cta.title, `${page.id}-cta-title`, 'CTA Title', 'Title') : ''}
            ${page.cta.text ? this.renderCopyCard(page.cta.text, `${page.id}-cta-text`, 'CTA Text', 'Text') : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${page.cta.buttonText ? this.renderCopyCard(page.cta.buttonText, `${page.id}-cta-btn`, 'Button Label', 'Button') : ''}
              ${page.cta.buttonLink ? this.renderCopyCard(page.cta.buttonLink, `${page.id}-cta-link`, 'Target Link', 'Link') : ''}
            </div>
          </div>
        </div>
      `;
    }

    // 9. Designer Notes
    if (page.designerNotes?.length > 0) {
      html += `
        <div class="section-block">
          <div class="section-block-header">
            <h3>Designer Notes</h3>
            <span class="badge-version">Notes</span>
          </div>
          <div class="section-block-body">
            ${page.designerNotes.map((note, idx) => 
              this.renderCopyCard(note, `${page.id}-note-${idx}`, `Note ${idx+1}`, 'Note')
            ).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  /**
   * Helper: Render single 1-click copy card
   */
  renderCopyCard(text, elementId, label, badge) {
    if (!text) return '';
    const isCopied = this.state.copiedIds.has(elementId);
    const isModified = this.state.modifiedIds.has(elementId);

    // Save in memory registry for event delegation
    this.cardTextRegistry.set(elementId, { text, label });

    return `
      <div class="copy-card ${isCopied ? 'copied' : ''} ${isModified ? 'updated-modified' : ''}" 
           data-element-id="${elementId}"
           role="button"
           tabindex="0"
           title="Click or press Enter to copy ${this.escapeHTML(label)}">
        <div class="copy-card-header">
          <div class="copy-card-label">
            <span>${this.escapeHTML(label)}</span>
            ${isModified ? '<span class="badge-modified">Updated</span>' : ''}
          </div>
          <div class="copy-card-actions">
            <span class="copy-badge-pill">${isCopied ? 'Copied' : (badge || 'Copy')}</span>
          </div>
        </div>
        <div class="copy-card-content">${this.escapeHTML(text)}</div>
      </div>
    `;
  }

  /**
   * Render Quick Business Drawer (Phone variations, Email, Address, Hours, Socials)
   */
  renderQuickBusinessDrawer() {
    const container = document.getElementById('quickChipsContainer');
    if (!container) return;

    const info = this.state.project?.businessInfo || {};
    const items = [];

    if (info.companyName) items.push({ label: 'Company', val: info.companyName });
    if (info.phone) items.push({ label: 'Phone', val: info.phone });
    if (info.phoneButton) items.push({ label: 'Phone (Button)', val: info.phoneButton });
    if (info.phoneLink) items.push({ label: 'Phone (Link)', val: info.phoneLink });
    if (info.email) items.push({ label: 'Email', val: info.email });
    if (info.address) items.push({ label: 'Address', val: info.address });
    if (info.hours) items.push({ label: 'Hours', val: info.hours });

    if (info.socialMedia && info.socialMedia.length > 0) {
      info.socialMedia.forEach(s => {
        items.push({ label: s.platform, val: s.url });
      });
    }

    if (items.length === 0) {
      container.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); padding: 8px 12px; font-family: var(--font-mono); line-height: 1.5;">No business info detected. Contact details appear here once loaded.</div>`;
      return;
    }

    container.innerHTML = items.map((item, idx) => {
      const elId = `quick-${idx}`;
      this.cardTextRegistry.set(elId, { text: item.val, label: item.label });
      return `
        <div class="quick-chip" data-element-id="${elId}" role="button" tabindex="0" title="Click or press Enter to copy ${this.escapeHTML(item.label)}">
          <span class="chip-label">${this.escapeHTML(item.label)}:</span>
          <span class="chip-val">${this.escapeHTML(item.val)}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Update Progress Meter
   */
  updateProgressMeter() {
    const fillEl = document.getElementById('progressBarFill');
    const statsEl = document.getElementById('progressStats');
    if (!fillEl || !statsEl) return;

    if (!this.state.project) {
      fillEl.style.width = '0%';
      statsEl.textContent = '0/0 (0%)';
      return;
    }

    const totalElements = document.querySelectorAll('.copy-card, .bullet-item-card').length;
    const copiedOnPage = document.querySelectorAll('.copy-card.copied, .bullet-item-card.copied').length;

    const percent = totalElements > 0 ? Math.round((copiedOnPage / totalElements) * 100) : 0;

    fillEl.style.width = `${percent}%`;
    statsEl.textContent = `${copiedOnPage}/${totalElements} (${percent}%)`;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2400);
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeQuotes(str) {
    if (!str) return '';
    return str.toString()
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }
}

// Instantiate global app instance
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new ContentFlowApp();
  window.app = app;
});
