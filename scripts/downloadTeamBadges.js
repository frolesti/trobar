/**
 * Script per descarregar escuts d'equips des de fonts públiques
 * 
 * Descarrega escuts de La Liga i Liga F i els guarda a assets/img/teams/
 * Després es poden pujar a Firebase amb uploadTeamBadges.js
 * 
 * Ús: node scripts/downloadTeamBadges.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// URLs dels escuts (fonts públiques: Wikipedia Commons, Wikimedia, APIs públiques)
const TEAM_BADGES = {
    // La Liga - Fonts alternatives: logos directes de Wikimedia Commons (domini públic/CC)
    'barcelona': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    'real-madrid': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
    'atletico-madrid': 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
    'valencia': 'https://upload.wikimedia.org/wikipedia/en/c/ce/Valenciacf.svg',
    'sevilla': 'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg',
    'athletic-bilbao': 'https://upload.wikimedia.org/wikipedia/en/9/98/Club_Athletic_Bilbao_logo.svg',
    'real-sociedad': 'https://upload.wikimedia.org/wikipedia/en/f/f1/Real_Sociedad_logo.svg',
    'villarreal': 'https://upload.wikimedia.org/wikipedia/en/b/b9/Villarreal_CF_logo-en.svg',
    'betis': 'https://upload.wikimedia.org/wikipedia/en/1/13/Real_betis_logo.svg',
    'celta': 'https://upload.wikimedia.org/wikipedia/en/1/12/RC_Celta_de_Vigo_logo.svg',
    'espanyol': 'https://upload.wikimedia.org/wikipedia/en/7/7c/RCD_Espanyol_logo.svg',
    'getafe': 'https://upload.wikimedia.org/wikipedia/en/4/46/Getafe_logo.svg',
    'granada': 'https://upload.wikimedia.org/wikipedia/en/4/45/Granada_CF_logo.svg',
    'levante': 'https://upload.wikimedia.org/wikipedia/en/7/7b/Levante_Unión_Deportiva%2C_S.A.D._logo.svg',
    'mallorca': 'https://upload.wikimedia.org/wikipedia/en/e/e0/RCD_Mallorca.svg',
    'osasuna': 'https://upload.wikimedia.org/wikipedia/en/c/c2/Club_Atletico_Osasuna_logo.svg',
    'rayo-vallecano': 'https://upload.wikimedia.org/wikipedia/en/3/38/Rayo_Vallecano_logo.svg',
    'valladolid': 'https://upload.wikimedia.org/wikipedia/en/d/d1/Real_Valladolid_Logo.svg',
    'alaves': 'https://upload.wikimedia.org/wikipedia/en/b/b9/Deportivo_Alaves_logo_%282020%29.svg',
    'cadiz': 'https://upload.wikimedia.org/wikipedia/en/5/58/C%C3%A1diz_CF_logo.svg',
    'elche': 'https://upload.wikimedia.org/wikipedia/en/2/23/Elche_CF_logo.svg',
    'eibar': 'https://upload.wikimedia.org/wikipedia/en/7/75/SD_Eibar_logo.svg',
    'girona': 'https://upload.wikimedia.org/wikipedia/en/7/79/Girona_FC_logo.svg',
    'las-palmas': 'https://upload.wikimedia.org/wikipedia/en/2/20/UD_Las_Palmas_logo.svg',
    'almeria': 'https://upload.wikimedia.org/wikipedia/en/e/e0/UD_Almeria_logo.svg',
    'sporting': 'https://upload.wikimedia.org/wikipedia/en/6/67/Real_Sporting_de_Gij%C3%B3n_logo.svg',
    'zaragoza': 'https://upload.wikimedia.org/wikipedia/en/f/f5/Real_Zaragoza_logo.svg',
};

async function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const options = {
            headers: {
                'User-Agent': 'Trobar/1.0 (https://trobar.app; contact@trobar.app) Node.js/' + process.version
            }
        };
        
        protocol.get(url, options, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(outputPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });
            } else if (res.statusCode === 301 || res.statusCode === 302) {
                // Seguir redirect
                downloadImage(res.headers.location, outputPath).then(resolve).catch(reject);
            } else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

async function convertSvgToPng(svgPath, pngPath) {
    // Per convertir SVG a PNG, necessitem una eina externa
    // Com a workaround, descarreguem directament PNG si hi ha disponibles
    // O usem les URLs de thumbnail de Wikimedia
    
    const teamName = path.basename(svgPath, '.svg');
    
    // Wikimedia té una API per obtenir thumbnails PNG des de SVG
    // Format: https://commons.wikimedia.org/wiki/Special:FilePath/{filename}?width=200
    
    const originalUrl = TEAM_BADGES[teamName];
    if (originalUrl.includes('wikimedia.org') && originalUrl.endsWith('.svg')) {
        const filename = originalUrl.split('/').pop();
        const pngUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=200`;
        
        try {
            await downloadImage(pngUrl, pngPath);
            console.log(`   ✅ Convertit: ${teamName}.png`);
            // Eliminar SVG temporal
            if (fs.existsSync(svgPath)) {
                fs.unlinkSync(svgPath);
            }
        } catch (error) {
            console.error(`   ❌ Error convertint ${teamName}:`, error.message);
        }
    }
}

async function main() {
    console.log('🔵 Descarregant escuts d\'equips...\n');
    
    const outputDir = path.join(__dirname, '..', 'assets', 'img', 'teams');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    let downloaded = 0;
    let failed = 0;
    
    for (const [teamName, url] of Object.entries(TEAM_BADGES)) {
        const svgPath = path.join(outputDir, `${teamName}.svg`);
        const pngPath = path.join(outputDir, `${teamName}.png`);
        
        if (fs.existsSync(pngPath)) {
            console.log(`   ⏭️ Ja existeix: ${teamName}.png`);
            continue;
        }
        
        try {
            // Descarregar SVG primer
            await downloadImage(url, svgPath);
            
            // Convertir a PNG usant la API de Wikimedia
            await convertSvgToPng(svgPath, pngPath);
            
            downloaded++;
        } catch (error) {
            console.error(`   ❌ Error descarregant ${teamName}:`, error.message);
            failed++;
        }
    }
    
    console.log(`\n✅ Descarregats: ${downloaded}`);
    if (failed > 0) {
        console.log(`❌ Errors: ${failed}`);
    }
}

main().catch(console.error);
