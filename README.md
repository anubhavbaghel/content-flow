# ⚡ ContentFlow: Web Developer 1-Click Copy Dashboard

> **Solve Copy-Paste Fatigue**: Transform messy Google Docs and JSON files into an interactive, section-by-section, element-by-element **1-Click Copy Dashboard** with **Live Google Docs Sync** for organization-restricted workspaces.

---

## 🌟 Key Features

1. **1-Click Instant Copy**:
   - Every element (Meta title, Meta description, H1, Hero summary, Value Proposition heading/body, H2 paragraphs, Bullet points, FAQ questions/answers, CTA buttons, links) is rendered in an individual card.
   - Click anywhere on a card to copy the exact clean text directly to your clipboard with instant visual feedback and toast confirmation.
   - Automatically tracks copied items with progress counters (`45 / 120 copied`).

2. **Live Google Docs Sync (Method 1 - Organization Protected)**:
   - Connects directly to Google Docs within your company's Google Workspace domain.
   - Automatically syncs whenever content writers update the doc (Auto-poll every 15s, 30s, or 1m, or click **"🔄 Sync Doc"**).
   - **Smart Diff & Change Detection**: Highlights modified elements with an `Updated in Doc` badge so developers immediately spot changes.

3. **Multi-Input Flexibility**:
   - **Live Google Doc Link**: Paste URL for continuous live cloud updates.
   - **Smart Clipboard Paste (`Ctrl+V`)**: Press `Ctrl+V` anywhere to instantly parse clipboard text/HTML in 0.1s.
   - **Drag & Drop Local Files**: Supports `.html`, `.json`, and `.txt` files directly.

4. **Structured Categorization**:
   - **🏠 Main Pages**: Home, Contact Us.
   - **🛠️ Services**: Chimney Sweeping, Repairs, Smoke Tests, CCTV Surveys, Stove Repairs, Cowls, Nest Removal.
   - **📍 Locations**: Tunbridge Wells, Rusthall, Tonbridge, Paddock Wood, Pembury, Hadlow, Edenbridge, Crowborough, Wadhurst, Sevenoaks, Langton Green, Four Elms.
   - **🏢 Quick Business Drawer**: Persistent 1-click access to company phone, dial links, email, address, operating hours, and social media URLs.

---

## 🚀 How to Run the Tool

### Option A: Open directly in your browser
Simply double-click `index.html` to open it in Chrome, Edge, or Firefox.

### Option B: Run via a local web server (Recommended)
In the project directory, run:
```bash
# Using Python
python -m http.server 8000

# Or using Node
npx serve .
```
Then visit `http://localhost:8000`.

---

## ⚙️ 2-Minute Google Apps Script Setup (Method 1)

To connect live to Google Docs restricted to your organization:

1. Open [script.google.com](https://script.google.com/home/start) using your organization Google account.
2. Click **"+ New project"**.
3. Copy all code from [`google_apps_script.js`](./google_apps_script.js) and paste it into the editor.
4. Click the blue **"Deploy"** button (top right) $\rightarrow$ **"New deployment"**.
5. Select type: **"Web app"**.
6. Set:
   - **Description**: `ContentFlow Sync API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone within [Your Organization]`
7. Click **Deploy** and authorize permissions when prompted.
8. Copy the **Web App URL** (e.g. `https://script.google.com/macros/s/.../exec`).
9. Open the ContentFlow Dashboard, click **⚙️ Setup**, paste the URL, and click **Save**.

Now, any developer in your organization can paste any internal Google Doc URL and receive live updates!
