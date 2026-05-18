'use server'


import { createProposal, getProposals, getProposalById, getLatestAIProcessing, getProposalItems, saveAIProcessing, updateProposal, saveProposalItems, deleteProposal } from '@/services/proposal'
import { createClient } from '@/lib/supabase/server'
import { CreateProposalInput } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { OpenAI } from 'openai'
import { SYSTEM_PROMPT } from '@/services/ai/prompt'
import { EXTRACTION_SYSTEM_PROMPT } from '@/services/ai/extraction_prompt'
import { parseAIResponseContent, normalizeAIItems } from '@/lib/pricing'

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

export async function interpretProposalAction(id: string, extraContext?: string) {
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

        if (extraContext) {
            userContent.push({
                type: "text",
                text: `ACLARACIÓN DEL CLIENTE: ${extraContext}`
            })
        }

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
            // Support both old format (plain array) and new format ({ items, existingMockup })
            const confirmedItems = Array.isArray(currentCtx) ? currentCtx : (currentCtx.items || currentCtx)
            const existingMockup: string = Array.isArray(currentCtx) ? '' : (currentCtx.existingMockup || '')

            userContent.push({
                type: "text",
                text: `EL USUARIO HA REVISADO Y CONFIRMADO LOS SIGUIENTES ÍTEMS PARA EL PRESUPUESTO.

INSTRUCCIONES OBLIGATORIAS:
1. USA EXACTAMENTE ESTOS ÍTEMS. NO CAMBIES LOS NOMBRES, NI LAS MEDIDAS, NI LOS ELIMINES.
2. IGNORA CUALQUIER REGLA DE NORMALIZACIÓN ANTERIOR (como 'ancho siempre mayor que alto').
3. CALCULA EL PRECIO DE CADA ÍTEM (MÁXIMO ENTRE 28€/m² O MÍNIMO DE 80€).
4. PARA EL MOCKUP ASCII:${existingMockup
    ? `
   - El usuario YA APROBÓ el siguiente mockup en la pantalla de previsualización.
   - CÓPIALO EXACTAMENTE TAL CUAL en el campo "ascii_mockup". NO lo regeneres ni cambies.
   - Solo corrige si hay un error evidente (medidas incorrectas), y si lo haces, mantén el mismo estilo y proporciones.
   MOCKUP APROBADO:
\`\`\`
${existingMockup}
\`\`\``
    : `
   - Genera un mockup ASCII proporcional con el nombre y medidas de cada ítem claramente indicados.
   - FORMATO: +---+ con | y ~, medidas dentro del rectángulo (ej: "3.50m x 2.10m").`}
5. SI UN ÍTEM TIENE MEDIDAS 0, DESCÁRTALO O AVISA EN 'missing_info'.
6. NO USES LOS EJEMPLOS DEL PROMPT DEL SISTEMA. USA ESTOS DATOS REALES:

ÍTEMS CONFIRMADOS: ${JSON.stringify(confirmedItems)}`
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
            result = parseAIResponseContent(content)
        } catch (parseError) {
            console.error('[AI] JSON Parse Error:', parseError, content);
            const preview = content.substring(0, 50).replace(/\n/g, ' ');
            throw new Error(`La IA devolvió un formato inválido. (${preview}...)`);
        }

        try {
            result = normalizeAIItems(result)
        } catch (normError: any) {
            console.error('[AI] ERROR: items normalization failed', result);
            throw new Error(normError.message || 'La IA no generó los ítems correctamente.');
        }

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

export interface InstallationData {
    address?: string
    notes?: string
    beforePhotos?: string[]
    scheduledAt?: string // ISO datetime for the appointment
}

export async function closeSaleAction(id: string, installation?: InstallationData) {
    try {
        const supabase = await createClient()
        const proposal = await getProposalById(id)

        if (!proposal) throw new Error("Propuesta no encontrada")

        const whatsapp = proposal.whatsapp?.replace(/\D/g, '')

        // 1. Update Proposal Status only (installation columns may not exist in schema)
        await updateProposal(id, { status: 'Confirmada' })

        // 2. Ensure Client exists and Create Appointment (non-fatal if fails)
        if (whatsapp) {
            try {
                const { data: client } = await supabase
                    .from('clients')
                    .upsert(
                        { name: proposal.cliente_nome, whatsapp },
                        { onConflict: 'whatsapp' }
                    )
                    .select()
                    .single()

                if (client) {
                    const appointmentDate = installation?.scheduledAt
                        ? new Date(installation.scheduledAt).toISOString()
                        : new Date().toISOString()

                    const notesText = [
                        `Venta cerrada desde presupuesto ${id}.`,
                        `Total: €${proposal.total_geral}`,
                        installation?.address ? `Dirección: ${installation.address}` : '',
                        installation?.notes ? installation.notes : '',
                    ].filter(Boolean).join(' | ')

                    await supabase
                        .from('appointments')
                        .insert({
                            client_id: client.id,
                            date_start: appointmentDate,
                            date_end: appointmentDate,
                            scheduled_at: appointmentDate,
                            status: 'confirmed',
                            notes: notesText,
                            installation_address: installation?.address || proposal.cidade || null,
                            total_value: proposal.total_geral || null,
                            special_attention: false,
                        })
                }
            } catch (aptErr) {
                console.error('Appointment creation failed (sale still closed):', aptErr)
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

export async function addAfterPhotosAction(id: string, photoUrls: string[]) {
    try {
        const proposal = await getProposalById(id)
        const existing = proposal.after_photos || []
        await updateProposal(id, { after_photos: [...existing, ...photoUrls] })
        revalidatePath(`/proposal/${id}/report`)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to add after photos:', error)
        return { success: false, error: error.message || 'Error al guardar fotos' }
    }
}

export async function getSalesAction() {
    try {
        const supabase = await createClient()

        // Sales = all appointments (agendamento = venda)
        const { data: appointments, error: aptError } = await supabase
            .from('appointments')
            .select('*, clients(id, name, whatsapp, location)')
            .order('scheduled_at', { ascending: false })

        if (aptError) throw aptError

        // Extract proposal IDs from appointment notes ("Venta cerrada desde presupuesto {uuid}.")
        const proposalIdRegex = /presupuesto ([0-9a-f-]{36})/i
        const proposalIds: string[] = []
        const aptToProposalId: Record<string, string> = {}

        for (const apt of appointments || []) {
            const match = (apt.notes || '').match(proposalIdRegex)
            if (match) {
                aptToProposalId[apt.id] = match[1]
                proposalIds.push(match[1])
            }
        }

        // Fetch linked proposals
        let proposalMap: Record<string, any> = {}
        let itemsByProposal: Record<string, any[]> = {}

        if (proposalIds.length > 0) {
            const { data: proposals } = await supabase
                .from('Proposta')
                .select('*')
                .in('id', proposalIds)

            for (const p of proposals || []) proposalMap[p.id] = p

            const { data: items } = await supabase
                .from('ItemProposta')
                .select('*')
                .in('proposta_id', proposalIds)

            for (const item of items || []) {
                if (!itemsByProposal[item.proposta_id]) itemsByProposal[item.proposta_id] = []
                itemsByProposal[item.proposta_id].push(item)
            }
        }

        const sales = (appointments || []).map((apt: any) => {
            const proposalId = aptToProposalId[apt.id]
            const proposal = proposalId ? proposalMap[proposalId] : null
            const items = proposalId ? (itemsByProposal[proposalId] || []) : []
            const totalM2FromItems = items.reduce((sum: number, i: any) => sum + (Number(i.area_m2) || 0), 0)
            return {
                // Appointment fields
                appointmentId: apt.id,
                appointmentStatus: apt.status,
                scheduledAt: apt.date_start || apt.scheduled_at,
                // Client fields
                cliente_nome: apt.clients?.name || proposal?.cliente_nome || '',
                whatsapp: apt.clients?.whatsapp || proposal?.whatsapp || '',
                cidade: apt.clients?.location || proposal?.cidade || '',
                // Sale data: appointment fields take priority over proposal fields
                proposalId: proposalId || null,
                installation_address: apt.installation_address || proposal?.installation_address || '',
                total_geral: apt.total_value || proposal?.total_geral || 0,
                items,
                totalM2: apt.total_m2 || totalM2FromItems || 0,
                totalItems: items.length,
            }
        })

        return { success: true, data: sales }
    } catch (error: any) {
        console.error('Failed to fetch sales:', error)
        return { success: false, error: error.message || 'Error al obtener ventas' }
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

export async function getAppointmentReportAction(id: string) {
    try {
        const supabase = await createClient()

        const { data: apt, error } = await supabase
            .from('appointments')
            .select('*, clients(id, name, whatsapp, location)')
            .eq('id', id)
            .single()

        if (error || !apt) throw new Error('Cita no encontrada')

        // Try to find linked proposal from notes
        const proposalIdRegex = /presupuesto ([0-9a-f-]{36})/i
        const match = (apt.notes || '').match(proposalIdRegex)
        let proposal = null
        let items: any[] = []
        let processing = null

        if (match) {
            const proposalId = match[1]
            try {
                proposal = await getProposalById(proposalId)
                items = await getProposalItems(proposalId)
                processing = await getLatestAIProcessing(proposalId)
            } catch {
                // proposal may have been deleted
            }
        }

        return { success: true, data: { appointment: apt, proposal, items, processing } }
    } catch (error: any) {
        console.error('Failed to fetch appointment report:', error)
        return { success: false, error: error.message || 'Error al obtener la ficha' }
    }
}

export async function addAppointmentAfterPhotosAction(id: string, photoUrls: string[]) {
    try {
        const supabase = await createClient()

        const { data: apt, error: fetchError } = await supabase
            .from('appointments')
            .select('after_photos')
            .eq('id', id)
            .single()

        if (fetchError) throw fetchError

        const existing: string[] = apt?.after_photos || []
        const { error } = await supabase
            .from('appointments')
            .update({ after_photos: [...existing, ...photoUrls] })
            .eq('id', id)

        if (error) throw error

        revalidatePath(`/dashboard/citas/${id}/report`)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to add after photos to appointment:', error)
        return { success: false, error: error.message || 'Error al guardar fotos' }
    }
}

export async function addAppointmentBeforePhotosAction(id: string, photoUrls: string[]) {
    try {
        const supabase = await createClient()

        const { data: apt, error: fetchError } = await supabase
            .from('appointments')
            .select('before_photos')
            .eq('id', id)
            .single()

        if (fetchError) throw fetchError

        const existing: string[] = apt?.before_photos || []
        const { error } = await supabase
            .from('appointments')
            .update({ before_photos: [...existing, ...photoUrls] })
            .eq('id', id)

        if (error) throw error

        revalidatePath(`/dashboard/citas/${id}/report`)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to add before photos to appointment:', error)
        return { success: false, error: error.message || 'Error al guardar fotos' }
    }
}

export async function deleteAppointmentPhotoAction(id: string, photoUrl: string, type: 'before' | 'after') {
    try {
        const supabase = await createClient()
        const col = type === 'before' ? 'before_photos' : 'after_photos'

        const { data: apt, error: fetchError } = await supabase
            .from('appointments')
            .select(col)
            .eq('id', id)
            .single()

        if (fetchError) throw fetchError

        const existing: string[] = (apt as any)?.[col] || []
        const { error } = await supabase
            .from('appointments')
            .update({ [col]: existing.filter(u => u !== photoUrl) })
            .eq('id', id)

        if (error) throw error

        revalidatePath(`/dashboard/citas/${id}/report`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al eliminar foto' }
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

export async function saveBuilderItemsAction(
    proposalId: string,
    items: { name: string; width: number; height: number; area: number; price: number }[],
    mockup: string,
    total: number,
) {
    try {
        const result = {
            items,
            ascii_mockup: mockup,
            pricing_logic: items.map(i =>
                `${i.name}: ${i.width.toFixed(2)}×${i.height.toFixed(2)}m = ${i.area.toFixed(2)}m² → €${i.price.toFixed(2)}`
            ).join('\n'),
            total,
        }
        await saveAIProcessing(proposalId, result, 'builder', items)
        revalidatePath(`/proposal/${proposalId}`)
        revalidatePath('/dashboard/presupuestos')
        return { success: true }
    } catch (error: any) {
        console.error('Failed to save builder items:', error)
        return { success: false, error: error.message || 'Error al guardar ítems' }
    }
}
