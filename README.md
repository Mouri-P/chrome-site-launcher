# Site Launcher - Chrome Extension

A beautiful Mac Launchpad-style interface for launching your favorite websites. Add any website with a single click and access them from a gorgeous grid layout that appears on every new tab.

## Features

✨ **Beautiful Interface** - Mac Launchpad-inspired design with smooth animations  
🎯 **Quick Access** - Click any site icon to instantly open it  
➕ **Easy to Add** - Click the extension icon on any page to add it to your launcher  
🎨 **Auto Icons** - Automatically fetches site favicons or creates beautiful fallbacks  
✏️ **Edit & Delete** - Click the edit button on any icon to modify or remove sites  
🎨 **Customizable Themes** - Choose from colors or upload your own background images  
📥 **Import/Export** - Backup your sites or import from Chrome's frequently visited sites  
⚡ **Advanced Scripts** - Inject custom JavaScript into specific websites (opt-in feature)

## Installation

### Quick Start - 2 Steps!

**The icons are already created!** Just install the extension:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `site-launcher` folder
5. Done! 🎉

### Step 2: Start Adding Sites

Open a new tab and you'll see your Site Launcher! The extension uses website favicons automatically - no icon setup needed.

## Usage

### Adding Sites

**Method 1: From Any Page**
1. Navigate to any website you want to add
2. Click the Site Launcher extension icon in your toolbar
3. Optionally customize the name
4. Click "Add Site"

**Method 2: From New Tab**
1. Open a new tab (the launcher will appear)
2. Click the + button in the bottom-right corner
3. Enter the site name and URL
4. Click "Add Site"

### Managing Sites

- **Open Site**: Click any icon to open the site
- **Edit Site**: Hover over an icon and click the edit button (appears in top-right of icon)
- **Delete Site**: Click edit, then click the "Delete" button
- **Customize Theme**: Click the settings (⚙️) button to change background colors or images

### Customization

- **Change Theme**: Click the settings button (⚙️) to customize background colors or upload images
- **Import Sites**: Import from Chrome's frequently visited sites or from a JSON backup file
- **Export Sites**: Export your sites as JSON for backup or sharing

### Advanced Scripts (Optional)

Site Launcher includes an advanced feature that allows you to inject custom JavaScript into specific websites. This feature is opt-in only and requires explicit configuration:

- **Site-Specific Scripts**: Click the advanced icon (ℹ️) on any site to add custom scripts that run when you visit that site
- **Global Scripts**: Configure scripts that run on multiple websites matching a domain pattern
- **Safety Features**: Enable confirmation popups before scripts execute
- **Timing Control**: Choose when scripts execute (document_start, document_end, or document_idle)

**⚠️ Warning:** Injecting scripts into websites can modify website behavior and may violate website terms of service. Use this feature responsibly and only on websites where you have permission to do so.

## Technical Details

### Files Structure
```
site-launcher/
├── manifest.json          # Extension configuration
├── newtab.html           # New tab page HTML
├── newtab.css            # Styles for new tab page
├── newtab.js             # Logic for new tab page
├── popup.html            # Popup HTML (add site)
├── popup.js              # Popup logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

### Storage

Sites are stored locally using Chrome's `chrome.storage.local` API. Your data is:
- Stored only on your computer
- Never sent to any server
- Automatically synced if you enable Chrome sync
- Preserved when updating the extension

### Permissions

- `storage` - To save your sites locally
- `tabs` - To get current tab information when adding sites
- `activeTab` - To access the current page title and URL
- `topSites` - To import your frequently visited sites (only when you explicitly click import)
- `scripting` - To inject user-defined scripts into websites (only when you explicitly configure scripts)
- `host_permissions (<all_urls>)` - Required to fetch favicons from any website and inject scripts (only when explicitly configured)

**Note:** The `<all_urls>` permission is required for the favicon fetching and script injection features. Scripts are only executed when you explicitly configure them for a specific site. The extension does not automatically inject scripts or access website content without your explicit configuration.

## Customization

### Change Background Gradient

Edit `newtab.css`, line 9-10:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

Replace with your preferred colors!

### Change Grid Size

Edit `newtab.css`, line 58:
```css
grid-template-columns: repeat(auto-fill, minmax(120px, 120px));
```

Change `120px` to make icons larger or smaller.

### Change Icon Border Radius

Edit `newtab.css`, line 85:
```css
border-radius: 22px;
```

Change value for more/less rounded corners (0 = square, 50px = circle).

## Troubleshooting

**Sites not saving?**
- Check Chrome's extension permissions
- Try reloading the extension

**Favicons not loading?**
- Some sites block favicon requests
- The extension will show a fallback with the first letter of the site name

**Extension not appearing on new tabs?**
- Make sure you loaded the unpacked extension
- Try closing all tabs and opening a new one
- Check for any errors in `chrome://extensions`

## Support

For issues or feature requests, please visit our [GitHub repository](https://github.com/Mouri-P/chrome-site-launcher) or open an issue. This is a fully open-source extension built with vanilla JavaScript, HTML, and CSS.

## License

Free to use and modify! Enjoy your beautiful site launcher! 🚀

## Repository

View the source code and contribute on [GitHub](https://github.com/Mouri-P/chrome-site-launcher)

