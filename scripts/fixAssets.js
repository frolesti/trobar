const fs = require('fs');
const path = require('path');

const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buffer = Buffer.from(b64, 'base64');

const assetsDir = path.join(__dirname, '../assets');
const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];

if (!fs.existsSync(assetsDir)){
    fs.mkdirSync(assetsDir);
}

files.forEach(file => {
    fs.writeFileSync(path.join(assetsDir, file), buffer);
    console.log(`Created ${file}`);
});
