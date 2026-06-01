const fs = window.require("fs");
const https = window.require("https");

module.exports = async function downloadAsset(assetUrl, destDir, filename) {
    const sep = destDir.endsWith('\\') || destDir.endsWith('/') ? '' : '\\';
    const destPath = destDir + sep + filename;

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    function downloadFile(downloadUrl, destinationPath) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(downloadUrl);
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
                timeout: 30000
            };
            const req = https.request(options, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302 ||
                    res.statusCode === 307 || res.statusCode === 308) {
                    downloadFile(res.headers.location, destinationPath).then(resolve).catch(reject);
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
                    const stats = fs.statSync(destinationPath);
                    if (stats.size === 0) reject(new Error('Empty file'));
                    else resolve(destinationPath);
                });
                fileStream.on('error', reject);
            });
            req.on('error', reject);
            req.on('timeout', () => req.destroy());
            req.end();
        });
    }

    return await downloadFile(assetUrl, destPath);
};
