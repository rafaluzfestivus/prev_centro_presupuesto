const JSZip = require('jszip');
const fs = require('fs');

async function testGen() {
    const data = fs.readFileSync('public/assets/presupuesto_preventiva.pptx');
    const zip = await JSZip.loadAsync(data);
    
    let slide5 = await zip.file('ppt/slides/slide5.xml').async('string');
    
    console.log("Before [PRECIO] included?", slide5.includes('[PRECIO]'));
    console.log("Before [X] included?", slide5.includes('[X]'));
    
    slide5 = slide5.replace('[PRECIO]', '999.00');
    slide5 = slide5.replace('[X]', '42.0');
    
    console.log("After [PRECIO] included?", slide5.includes('[PRECIO]'));
    console.log("After [X] included?", slide5.includes('[X]'));
    
    zip.file('ppt/slides/slide5.xml', slide5);
    
    let slide4 = await zip.file('ppt/slides/slide4.xml').async('string');
    
    // Check slide 4 items
    slide4 = slide4.replace('Esto es exactamente lo que necesitas.', '• Item 1: 10m²\n• Item 2: 5m²');
    // Replace Mockup
    let mockupXml = "MOCKUP_TEXT";
    slide4 = slide4.replace(
        'Vista del Proyecto', 
        'Vista del Proyecto</a:t></a:r></a:p><a:p><a:r><a:t>' + mockupXml
    );
    zip.file('ppt/slides/slide4.xml', slide4);

    const outData = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync('test_out.pptx', outData);
    console.log('Saved test_out.pptx');
}

testGen().catch(console.error);
