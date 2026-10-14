# ContentFlow: Web Developer 1-Click Copy Dashboard

> **Solve Copy-Paste Fatigue**: Transform Google Docs, `.docx`, `.html`, and `.json` files into an interactive, section-by-section, element-by-element **1-Click Copy Dashboard** with **Live Google Docs Sync** for organization-restricted workspaces.

---

## Key Features

1. **1-Click Instant Copy**:
   - Every element (Meta title, Meta description, H1, Hero summary, Value Proposition heading/body, H2 paragraphs, Bullet points, FAQ questions/answers, CTA buttons, links) is rendered in an individual card.
   - Click anywhere on a card to copy clean text directly to your clipboard with instant visual feedback and toast confirmation.
   - Automatically tracks copied items with progress counters (`45 / 120 copied`).

2. **Live Google Docs Sync (Organization Protected)**:
   - Connects directly to Google Docs within your company's Google Workspace domain.
   - Automatically syncs whenever content writers update the doc (Auto-poll every 15s, 30s, or 1m, or click **"Sync Doc"**).
   - **Smart Diff & Change Detection**: Highlights modified elements with an `Updated` badge in yellow that remains visible until copied, making it easy to spot revisions.

3. **Multi-Input Flexibility**:
   - **Native .docx & File Drag & Drop**: Drop Word `.docx`, `.html`, `.json`, or `.txt` files directly into the window (parsed client-side using Mammoth.js).
   - **Live Google Doc Link**: Paste URL for continuous live cloud updates via Google Apps Script bridge.
   - **Smart Clipboard Paste (`Ctrl+V`)**: Press `Ctrl+V` anywhere to instantly parse clipboard text/HTML in under 100ms.

4. **Structured Categorization**:
   - **Main Pages**: Home, Contact Us.
   - **Services**: Service sections with titles, descriptions, and CTA buttons.
   - **Locations**: Dedicated regional page breakdowns.
   - **Quick Business Drawer**: Persistent 1-click access to company phone, dial links, email, address, operating hours, and social media URLs.

---

## Development & Usage

### 1. Development Mode (Vite)
To start the local Vite development server with hot module reloading:
```bash
npm install
npm run dev
```
Then visit `http://localhost:5173`.

### 2. Run Automated Tests (Vitest)
Run the test suite verifying `.docx`, JSON, HTML, and text parsers:
```bash
npm test
```

### 3. Production Build
Bundle and minify the client for production deployment:
```bash
npm run build
```
The optimized output will be generated in `dist/`.

### 4. Standalone / Zero-Build Execution
You can also run ContentFlow without a build step:
- Open `index.html` directly in any modern browser, or
- Run a static file server:
  ```bash
  npx serve .
  # or
  python -m http.server 8000
  ```

---

## Google Apps Script Setup (Optional Live Sync)

To connect live to Google Docs restricted to your organization:

1. Open [script.google.com](https://script.google.com/home/start) with your organization Google account.
2. Click **"+ New project"**.
3. Copy all code from [`google_apps_script.js`](./google_apps_script.js) and paste it into the editor.
4. Click **"Deploy"** (top right) -> **"New deployment"**.
5. Select type: **"Web app"**.
6. Set:
   - **Description**: `ContentFlow Sync API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone within [Your Organization]`
7. Click **Deploy** and authorize permissions when prompted.
8. Copy the **Web App URL** (e.g. `https://script.google.com/macros/s/.../exec`).
9. In ContentFlow, click **Setup**, paste the URL, and click **Save**.
