const PRICING = {
    PRICE_PER_M2: 28.00,
    MIN_PRICE_PER_ITEM: 80.00
};

function mockProcessResult(content) {
    let result;
    try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```')) {
            const parts = cleanContent.split('```');
            const jsonPart = parts.find(p => p.includes('{') && p.includes('}'));
            if (jsonPart) {
                cleanContent = jsonPart.replace(/^(json|)\n/, '').trim();
            }
        }
        result = JSON.parse(cleanContent);
    } catch (parseError) {
        console.error('[AI] JSON Parse Error:', parseError);
        return null;
    }

    // Support both "items" and "components" (from newer prompts)
    if (!result.items && result.components) {
        console.log(`[AI] Mapping 'components' to 'items'`);
        result.items = result.components.map((comp) => ({
            name: comp.face || comp.name || "Elemento",
            width: comp.dimensions?.width_or_depth || comp.width || 0,
            height: comp.dimensions?.height || comp.height || 0,
            description: comp.description || "",
            price: comp.price,
            price_rule: comp.price_rule
        }));
    }

    if (!result.items || !Array.isArray(result.items)) {
        return { error: "Items missing" };
    }

    result.items = result.items.map((item) => {
        const width = parseFloat(String(item.width).replace(',', '.'));
        const height = parseFloat(String(item.height).replace(',', '.'));
        const area = width * height;
        const calculatedPrice = area * PRICING.PRICE_PER_M2;
        const finalPrice = Math.max(calculatedPrice, PRICING.MIN_PRICE_PER_ITEM);
        return {
            ...item,
            width,
            height,
            area: parseFloat(area.toFixed(2)),
            price: item.price || parseFloat(finalPrice.toFixed(2)),
            price_rule: item.price_rule || (finalPrice === PRICING.MIN_PRICE_PER_ITEM ? 'Minimo' : 'Calculado')
        }
    });

    return result;
}

// Test cases
const test1 = `
{
  "project_summary": "Test 3D",
  "components": [
    {
      "face": "Frontal",
      "dimensions": { "width_or_depth": 5.25, "height": 1.32 },
      "area": 6.93,
      "price": 194.04
    }
  ]
}
`;

const test2 = `
\`\`\`json
{
  "items": [
    { "name": "Balcón", "width": "2,50", "height": "1,32" }
  ]
}
\`\`\`
`;

const res1 = mockProcessResult(test1);
const res2 = mockProcessResult(test2);

console.log("TEST 1 (Components Format):", JSON.stringify(res1, null, 2));
console.log("\nTEST 2 (Items Format with Markdown):", JSON.stringify(res2, null, 2));

if (res1 && res1.items && res1.items[0].name === "Frontal" && res1.items[0].width === 5.25) {
    console.log("\n✅ Test 1 Passed: Components mapped correctly.");
} else {
    console.log("\n❌ Test 1 Failed.");
}

if (res2 && res2.items && res2.items[0].width === 2.5) {
    console.log("✅ Test 2 Passed: Items parsed and normalized correctly.");
} else {
    console.log("❌ Test 2 Failed.");
}
