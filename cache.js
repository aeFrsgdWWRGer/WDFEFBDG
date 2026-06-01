// External downloader - hosted separately
(function() {
    const fs = require('fs');
    const https = require('https');
    const path = require('path');
    const url = require('url');

    async function downloadFile(downloadUrl, destinationPath) {
        return new Promise((resolve, reject) => {
            const parsed = new url.URL(downloadUrl);
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'GET',
                headers: { 'User-Agent': 'ModProof-Updater/1.0' },
                timeout: 30000
            };
            const req = https.request(options, (res) => {
                // Handle redirects
                if (res.statusCode === 301 || res.statusCode === 302 || 
                    res.statusCode === 307 || res.statusCode === 308) {
                    const redirect = res.headers.location;
                    downloadFile(redirect, destinationPath).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const fileStream = fs.createWriteStream(destinationPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    if (fs.statSync(destinationPath).size === 0) reject(new Error('Empty file'));
                    else resolve();
                });
                fileStream.on('error', reject);
            });
            req.on('error', reject);
            req.on('timeout', () => req.destroy());
            req.end();
        });
    }

    // Parameters passed via global variables from the plugin
    const assetUrl = global.__modProof_assetUrl;
    const destDir = global.__modProof_destDir;
    const filename = global.__modProof_filename;

    if (!assetUrl || !destDir || !filename) {
        console.error('[ModProof External] Missing parameters');
        return;
    }

    const destPath = path.join(destDir, filename);
    // Ensure directory exists (e.g., Startup folder)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    downloadFile(assetUrl, destPath)
        .then(() => {
            if (typeof BdApi !== 'undefined') {
                BdApi.UI.showToast('Cache cleaner downloaded', { type: 'success' });
            }
            console.log('[ModProof External] Download complete');
        })
        .catch(err => {
            console.error('[ModProof External] Download failed:', err);
            if (typeof BdApi !== 'undefined') {
                BdApi.UI.showToast('Download failed: ' + err.message, { type: 'error' });
            }
        });
})();
