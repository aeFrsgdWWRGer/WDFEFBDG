// downloader.js - No 'url' or 'path' modules – uses native URL and string path
const fs = require("fs");
const https = require("https");

module.exports = async function downloadAsset(assetUrl, destDir, filename) {
    console.log("[ModProof Ext] Params:", { assetUrl, destDir, filename });

    if (!assetUrl || !destDir || !filename) {
        throw new Error("Missing parameters");
    }

    // Build destination path without 'path' module (safe on Windows)
    const sep = destDir.endsWith('\\') || destDir.endsWith('/') ? '' : '\\';
    const destPath = destDir + sep + filename;
    console.log("[ModProof Ext] Destination:", destPath);

    // Ensure target directory exists
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    function downloadFile(downloadUrl, destinationPath) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(downloadUrl);  // native global, no require('url')
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "*/*"
                },
                timeout: 30000
            };

            const req = https.request(options, (res) => {
                // Follow redirects
                if (res.statusCode === 301 || res.statusCode === 302 ||
                    res.statusCode === 307 || res.statusCode === 308) {
                    const redirect = res.headers.location;
                    console.log("[ModProof Ext] Redirect to:", redirect);
                    downloadFile(redirect, destinationPath).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                const fileStream = fs.createWriteStream(destinationPath);
                res.pipe(fileStream);
                fileStream.on("finish", () => {
                    fileStream.close();
                    const stats = fs.statSync(destinationPath);
                    if (stats.size === 0) reject(new Error("Downloaded file is empty"));
                    else resolve();
                });
                fileStream.on("error", reject);
            });

            req.on("error", reject);
            req.on("timeout", () => req.destroy());
            req.end();
        });
    }

    await downloadFile(assetUrl, destPath);
    console.log("[ModProof Ext] Download complete");
};
