const JSZip = require('jszip');
const fs = require('fs');

async function extract() {
    const data = fs.readFileSync('public/assets/presupuesto_preventiva.pptx');
    const zip = await JSZip.loadAsync(data);
    
    for (let i of [4, 5]) {
        const slideXml = await zip.file(`ppt/slides/slide${i}.xml`).async('string');
        fs.writeFileSync(`slide${i}_debug.xml`, slideXml);
        
        // Extract text
        const textMatches = slideXml.match(/<a:t>.*?<\/a:t>/g) || [];
        console.log(`--- SLIDE ${i} TEXT ---`);
        textMatches.forEach(t => console.log(t.replace(/<\/?a:t>/g, '')));
    }
}

extract().catch(console.error);
