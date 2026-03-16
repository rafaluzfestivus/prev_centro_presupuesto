const JSZip = require('jszip');
const fs = require('fs');

async function testGen() {
    const data = fs.readFileSync('public/assets/presupuesto_preventiva.pptx');
    const zip = await JSZip.loadAsync(data);
    
    let slide4 = await zip.file('ppt/slides/slide4.xml').async('string');

    const items = [
        {name: "Cara Frontal", width: 4.25, height: 1.40, area: 5.95},
        {name: "Cara Lateral", width: 1.25, height: 1.40, area: 1.75}
    ];

    const mockup = `  +------------------+
  |    Cara Frontal  |
  |    4.25m x 1.40m |
  +------------------+`;

    // 1. Text Items xml
    let textItemsXml = items.map(item => `
        <a:p>
            <a:pPr algn="l"><a:lnSpc><a:spcPts val="1200"/></a:lnSpc></a:pPr>
            <a:r>
                <a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr>
                <a:t>• ${item.name}: ${Number(item.width).toFixed(2)}x${Number(item.height).toFixed(2)}m (${Number(item.area).toFixed(2)}m²)</a:t>
            </a:r>
        </a:p>
    `).join('');

    const leftBoxXml = `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="900" name="InsertedTextItems"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="1188720" y="4200000"/>
      <a:ext cx="7315200" cy="4000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"/>
    <a:lstStyle/>
    ${textItemsXml}
  </p:txBody>
</p:sp>
`;

    // 2. Mockup xml
    let mockupLinesXml = mockup.split('\n').map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('</a:t></a:r></a:p><a:p><a:pPr algn="ctr"><a:lnSpc><a:spcPts val="1200"/></a:lnSpc></a:pPr><a:r><a:rPr sz="1200" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t>');
    let mockupXml = `
        <a:p>
            <a:pPr algn="ctr"><a:lnSpc><a:spcPts val="1200"/></a:lnSpc></a:pPr>
            <a:r>
                <a:rPr sz="1200" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr>
                <a:t>${mockupLinesXml}</a:t>
            </a:r>
        </a:p>
    `;

    const rightBoxXml = `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="901" name="InsertedMockup"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="9509760" y="4200000"/>
      <a:ext cx="7863840" cy="4000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"/>
    <a:lstStyle/>
    ${mockupXml}
  </p:txBody>
</p:sp>
`;

    // 3. Inject into slide4
    // Replace the old text first
    slide4 = slide4.replace('Esto es exactamente lo que necesitas.', '');
    // slide4 = slide4.replace('Vista del Proyecto', 'Vista del Proyecto');

    const injectionString = leftBoxXml + rightBoxXml + '</p:spTree>';
    slide4 = slide4.replace('</p:spTree>', injectionString);

    zip.file('ppt/slides/slide4.xml', slide4);

    const outData = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync('test_out.pptx', outData);
    console.log('Saved test_out.pptx');
}

testGen().catch(console.error);
