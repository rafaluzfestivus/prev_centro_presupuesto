'use server'


import { createProposal, getProposals, getProposalById, getLatestAIProcessing, getProposalItems, saveAIProcessing, updateProposal, saveProposalItems, deleteProposal } from '@/services/proposal'
import { createClient } from '@/lib/supabase/server'
import { CreateProposalInput } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { OpenAI } from 'openai'
import { SYSTEM_PROMPT } from '@/services/ai/prompt'
import { EXTRACTION_SYSTEM_PROMPT } from '@/services/ai/extraction_prompt'
import { PRICING } from '@/lib/constants'

export async function createProposalAction(data: CreateProposalInput) {
    try {
        // TODO: Get real user ID from auth
        // const { userId } = auth() 
        const userId = '00000000-0000-0000-0000-000000000000' // Mock or undefined for now if auth not strict

        // Actually, we should check if we have a user. If anon, maybe explicit null?
        // creating with null for now as we might not have auth setup in this context fully verified

        const proposal = await createProposal(data, userId)
        revalidatePath('/painel')
        return { success: true, id: proposal.id }
    } catch (error: any) {
        console.error('Failed to create presupuesto:', error)
        return { success: false, error: error.message || String(error) }
    }
}

export async function getProposalsAction() {
    try {
        const proposals = await getProposals()
        return { success: true, data: proposals }
    } catch (error) {
        console.error('Failed to fetch presupuestos:', error)
        return { success: false, error: 'Error al obtener los presupuestos' }
    }
}

export async function getProposalDetailsAction(id: string) {
    try {
        const proposal = await getProposalById(id)
        const items = await getProposalItems(id)
        const processing = await getLatestAIProcessing(id)

        return { success: true, data: { proposal, items, processing } }
    } catch (error) {
        console.error('Failed to fetch presupuesto details:', error)
        return { success: false, error: 'Error al obtener los detalles del presupuesto' }
    }
}

export async function interpretProposalAction(id: string) {
    try {
        console.log(`[AI] Interpreting proposal ${id}...`)
        const proposal = await getProposalById(id)

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        const messages: any[] = [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT }
        ];

        const userContent: any[] = [
            { type: "text", text: `--- INTERPRETANDO PEDIDO ID: ${id} ---` },
            { type: "text", text: `INPUT ORIGINAL: ${proposal.medidas_input || 'Imagen adjunta'}` }
        ]

        if (proposal.input_image_url) {
            userContent.push({
                type: "image_url",
                image_url: { url: proposal.input_image_url },
            })
        }

        messages.push({ role: "user", content: userContent })

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.1,
        })

        let content = completion.choices[0].message.content
        if (!content) throw new Error("No AI content")

        let result = JSON.parse(content);
        return { success: true, data: result }

    } catch (error: any) {
        console.error('Failed to interpret presupuesto:', error)
        return { success: false, error: error.message || String(error) }
    }
}

export async function processProposalWithAIAction(id: string, instruction?: string, currentCtx?: any) {
    try {
        console.log(`[AI] Processing proposal ${id}...`)
        const proposal = await getProposalById(id)
        console.log(`[AI] Proposal found: ${proposal.cliente_nome}`)

        // --- AI LOGIC START ---
        console.log(`[AI] Initializing OpenAI with key: ${process.env.OPENAI_API_KEY ? 'Present' : 'MISSING'}`)
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        // Fetch System Prompt from DB - Synchronize with Dashboard Editor key
        const supabase = await createClient()
        const { data: configData } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'system_prompt')
            .single()

        const activeSystemPrompt = `${configData?.value || SYSTEM_PROMPT}\n\nIMPORTANTE: Responde siempre en formato JSON válido.`;
        console.log(`[AI] Using ${configData?.value ? 'DB proposal_system_prompt' : 'Hardcoded'} System Prompt`);

        const messages: any[] = [
            { role: "system", content: activeSystemPrompt }
        ];

        // Constrói o conteúdo para a IA
        const isConfirmedStep = instruction === 'confirmed_items';

        const userContent: any[] = [
            { type: "text", text: `--- TRABAJANDO EN EL PRESUPUESTO ID: ${id} ---` },
            {
                type: "text",
                text: isConfirmedStep
                    ? `DATOS ORIGINALES (OBSOLETOS - SOLO REFERENCIA): ${proposal.medidas_input || 'N/A'}`
                    : `DATOS ORIGINALES ENVIADOS POR EL CLIENTE (REFERENCIA PRINCIPAL): ${proposal.medidas_input || 'Imagen adjunta'}`
            }
        ]

        // Solo enviamos imagen si NO estamos en el paso de confirmación, para evitar que la IA
        // intente "re-interpretar" los píxeles ignorando las correcciones manuales del usuario.
        if (proposal.input_image_url && !isConfirmedStep) {
            userContent.push({
                type: "image_url",
                image_url: {
                    url: proposal.input_image_url,
                },
            })
        }

        if (instruction === 'confirmed_items' && currentCtx) {
            // Special case: we already have the items, just calc prices and generate mockup
            userContent.push({
                type: "text",
                text: `EL USUARIO HA REVISADO Y CONFIRMADO LOS SIGUIENTES ÍTEMS PARA EL PRESUPUESTO. 
                
                INSTRUCCIONES OBLIGATORIAS:
                1. USA EXACTAMENTE ESTOS ÍTEMS. NO CAMBIES LOS NOMBRES, NI LAS MEDIDAS, NI LOS ELIMINES.
                2. IGNORA CUALQUIER REGLA DE NORMALIZACIÓN ANTERIOR (como 'ancho siempre mayor que alto').
                3. CALCULA EL PRECIO DE CADA ÍTEM (MÁXIMO ENTRE 28€/m² O MÍNIMO DE 80€).
                4. GENERA UN NUEVO MOCKUP ASCII QUE REPRESENTE ESTOS ÍTEMS EXACTAMENTE, INCLUYENDO ETIQUETAS DE CARAS Y SUS MEDIDAS (Ancho x Alto).
                5. SI UN ÍTEM TIENE MEDIDAS 0, DESCÁRTALO O AVISA EN 'missing_info'.
                6. NO USES EL EJEMPLO DEL PROMPT DEL SISTEMA. USA ESTOS DATOS REALES A CONTINUACIÓN.
                
                ÍTEMS REALES CONFIRMADOS POR EL USUARIO: ${JSON.stringify(currentCtx)}`
            })
        } else if (currentCtx) {
            userContent.push({
                type: "text",
                text: `ESTADO ACTUAL DEL PRESUPUESTO (JSON): ${JSON.stringify(currentCtx)}`
            })
            userContent.push({
                type: "text",
                text: `INSTRUCCIÓN DE AJUSTE: ${instruction}`
            })
        } else {
            userContent.push({
                type: "text",
                text: "Analiza el input original e crea el presupuesto inicial."
            })
        }

        if (instruction === 'confirmed_items') {
            console.log(`[AI] Processing confirmed items:`, currentCtx)
        }

        messages.push({ role: "user", content: userContent })

        console.log(`[AI] Sending request to GPT-4o...`)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.1,
        })
        console.log(`[AI] Response received from OpenAI`)
        let content = completion.choices[0].message.content
        if (!content) throw new Error("No AI content")

        let result;
        try {
            // More robust cleaning: only split if looks like markdown
            let cleanContent = content.trim();
            if (cleanContent.startsWith('```')) {
                const parts = cleanContent.split('```');
                // find the part that looks like JSON
                const jsonPart = parts.find(p => p.includes('{') && p.includes('}'));
                if (jsonPart) {
                    cleanContent = jsonPart.replace(/^(json|)\n/, '').trim();
                }
            }

            result = JSON.parse(cleanContent);
        } catch (parseError) {
            console.error('[AI] JSON Parse Error:', parseError, content);
            const preview = content.substring(0, 50).replace(/\n/g, ' ');
            throw new Error(`La IA devolvió un formato inválido. (${preview}...)`);
        }

        // Support both "items" and "components" (from newer prompts)
        if (!result.items && result.components) {
            console.log(`[AI] Mapping 'components' to 'items'`);
            result.items = result.components.map((comp: any) => ({
                name: comp.face || comp.name || "Elemento",
                width: comp.dimensions?.width_or_depth || comp.width || 0,
                height: comp.dimensions?.height || comp.height || 0,
                description: comp.description || "",
                price: comp.price,
                price_rule: comp.price_rule
            }));
        }

        if (!result.items || !Array.isArray(result.items)) {
            console.error(`[AI] ERROR: result.items is missing or not an array`, result);
            throw new Error("La IA no generó los ítems correctamente. Verifique si las medidas están claras en el pedido.");
        }

        // Apply pricing minimums manually if AI forgets, or let AI do it. 
        // The system prompt should handle it, but let's ensure.
        result.items = result.items.map((item: any) => {
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
        result.total = result.items.reduce((sum: number, item: any) => sum + item.price, 0);

        // Save to DB
        console.log(`[AI] Saving processing result to DB...`)
        await saveAIProcessing(id, result, instruction || proposal.medidas_input, result.items)
        console.log(`[AI] Processing completed and saved for ${id}`)

        revalidatePath(`/proposal/${id}`)
        return { success: true, data: result }

    } catch (error: any) {
        console.error('Failed to process presupuesto:', error)
        return { success: false, error: error.message || String(error) }
    }
}

export async function confirmProposalAction(id: string, total: number, items: any[]) {
    try {
        const supabase = await createClient()

        // 1. Get proposal to get whatsapp and other data
        const proposal = await getProposalById(id)
        const whatsapp = proposal.whatsapp?.replace(/\D/g, '')

        // 2. Save manual edits first
        await saveProposalItems(id, items, total)

        // 3. Then confirm status
        await updateProposal(id, {
            status: 'Confirmada',
            data_confirmacao: new Date().toISOString()
        })

        console.log(`[AI] Confirmed items for proposal ${id}`)

        // 4. Create/Update Client if whatsapp is present
        if (whatsapp) {
            // Upsert client - always keep client data updated
            const { data: client, error: clientError } = await supabase
                .from('clients')
                .upsert({
                    name: proposal.cliente_nome,
                    whatsapp: whatsapp,
                    location: proposal.cidade,
                    source: 'proposta',
                    status: 'lead'
                }, { onConflict: 'whatsapp' })
                .select()
                .single()

            if (clientError) console.error('Error upserting client:', clientError)
        }

        revalidatePath(`/proposal/${id}`)
        revalidatePath('/dashboard/presupuestos')
        revalidatePath('/dashboard/clientes')
        return { success: true }
    } catch (error) {
        console.error('Failed to confirm:', error)
        return { success: false, error: 'Error al confirmar' }
    }
}

export async function closeSaleAction(id: string) {
    try {
        const supabase = await createClient()
        const proposal = await getProposalById(id)

        if (!proposal) throw new Error("Propuesta no encontrada")

        const whatsapp = proposal.whatsapp?.replace(/\D/g, '')

        // 1. Update Proposal Status to Closed
        await updateProposal(id, {
            status: 'Confirmada', // Assuming 'Confirmada' means closed/won in the current schema
            // If we have a 'Fechada' status, we should use it. 
            // Checking Proposta.status check constraint from previous tool call:
            // ARRAY['Rascunho'::text, 'Processada'::text, 'Confirmada'::text]
            // We'll stick to 'Confirmada' but we could use a field like 'closed_at' if it existed.
        })

        // 2. Ensure Client exists and Create Appointment
        if (whatsapp) {
            const { data: client } = await supabase
                .from('clients')
                .upsert({
                    name: proposal.cliente_nome,
                    whatsapp: whatsapp,
                    location: proposal.cidade,
                    source: 'proposta',
                    status: 'customer'
                }, { onConflict: 'whatsapp' })
                .select()
                .single()

            if (client) {
                const { error: aptError } = await supabase
                    .from('appointments')
                    .insert({
                        client_id: client.id,
                        scheduled_at: new Date().toISOString(),
                        status: 'pending',
                        notes: `Venta cerrada desde presupuesto ${id}. Total: €${proposal.total_geral}`
                    })

                if (aptError) throw aptError
            }
        }

        revalidatePath(`/proposal/${id}`)
        revalidatePath('/dashboard/citas')
        revalidatePath('/dashboard/presupuestos')

        return { success: true }
    } catch (error: any) {
        console.error('Failed to close sale:', error)
        return { success: false, error: error.message || 'Error al cerrar venta' }
    }
}

export async function updateProposalAction(id: string, updates: any) {
    try {
        await updateProposal(id, updates)
        revalidatePath(`/proposal/${id}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to update presupuesto:', error)
        return { success: false, error: 'Error al actualizar el presupuesto' }
    }
}

export async function deleteProposalAction(id: string) {
    try {
        await deleteProposal(id)
        revalidatePath('/painel')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete presupuesto:', error)
        return { success: false, error: 'Error al eliminar el presupuesto' }
    }
}
