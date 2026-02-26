
import { createClient } from '@/lib/supabase/server'
import { CreateProposalInput, Proposal, ProposalItem, AIProcessingResult } from '@/lib/types'

export async function createProposal(data: CreateProposalInput, userId?: string) {
    const supabase = await createClient()

    const { data: proposal, error } = await supabase
        .from('Proposta')
        .insert({
            cliente_nome: data.clientName,
            cidade: data.city,
            medidas_input: data.measurements,
            observacoes: data.observations,
            input_image_url: data.imageUrl,
            whatsapp: data.whatsapp,
            criado_por: userId,
            status: 'Rascunho'
        })
        .select()
        .single()

    if (error) throw error
    return proposal as Proposal
}

export async function getProposals(userId?: string) {
    const supabase = await createClient()

    let query = supabase
        .from('Proposta')
        .select('*')
        .order('data_criacao', { ascending: false })

    if (userId) {
        query = query.eq('criado_por', userId)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Proposal[]
}

export async function getProposalById(id: string) {
    const supabase = await createClient()

    const { data: proposal, error } = await supabase
        .from('Proposta')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return proposal as Proposal
}

export async function getProposalItems(proposalId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ItemProposta')
        .select('*')
        .eq('proposta_id', proposalId)
        .order('ordem', { ascending: true })

    if (error) throw error
    return data as ProposalItem[]
}

export async function getLatestAIProcessing(proposalId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ProcessamentoIA')
        .select('*')
        .eq('proposta_id', proposalId)
        .order('data_processamento', { ascending: false })
        .limit(1)
        .single()

    // It's possible to not have processing yet
    if (error && error.code !== 'PGRST116') throw error
    return data as AIProcessingResult | null
}

export async function updateProposal(id: string, updates: Partial<Proposal>) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('Proposta')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data as Proposal
}

export async function deleteProposal(id: string) {
    const supabase = await createClient()

    // 1. Delete related items first (orphan removal)
    await supabase.from('ItemProposta').delete().eq('proposta_id', id)

    // 2. Delete related AI processing
    await supabase.from('ProcessamentoIA').delete().eq('proposta_id', id)

    // 3. Delete the proposal itself
    const { error } = await supabase
        .from('Proposta')
        .delete()
        .eq('id', id)

    if (error) throw error
    return true
}

export async function saveAIProcessing(proposalId: string, result: any, rawPrompt: any, items: any[]) {
    const supabase = await createClient()

    // 1. Save AI Processing Record
    const { error: procError } = await supabase
        .from('ProcessamentoIA')
        .insert({
            proposta_id: proposalId,
            medidas_normalizadas: JSON.stringify(result.items), // Storing structure in text col for now or specific cols? 
            // DB ProcessamentoIA has: medidas_normalizadas (text), mockup_ascii (text), etc.
            mockup_ascii: result.ascii_mockup,
            tabela_precos: JSON.stringify(result.items), // redundant but fits schema cols
            logica_calculo: result.pricing_logic,
            total_calculado: result.total
        })
    if (procError) throw procError

    // 2. Clear old items and insert new ones
    const { error: delError } = await supabase
        .from('ItemProposta')
        .delete()
        .eq('proposta_id', proposalId)
    if (delError) throw delError

    if (items && items.length > 0) {
        const itemsToInsert = items.map((item: any, index: number) => ({
            proposta_id: proposalId,
            nome_ambiente: item.name,
            largura: item.width,
            altura: item.height,
            // area_m2: item.area, // Generated column
            valor_unitario: 28.00, // Fixed for now or from item?
            valor_total: item.price,
            ordem: index
        }))

        const { error: itemError } = await supabase
            .from('ItemProposta')
            .insert(itemsToInsert)
        if (itemError) throw itemError
    }

    // 3. Update Proposal with history and total
    // Fetch current prompts first to append
    const { data: currentProp } = await supabase.from('Proposta').select('prompts').eq('id', proposalId).single()
    const currentPrompts = currentProp?.prompts || []

    // Check if new prompt is already in (to avoid dupes on re-runs if logic assumes append)
    // For now simple append with timestamp
    const newPromptEntry = {
        timestamp: new Date().toISOString(),
        prompt: rawPrompt,
    }

    const { error: updateError } = await supabase
        .from('Proposta')
        .update({
            total_geral: result.total,
            status: 'Processada',
            prompts: [...currentPrompts, newPromptEntry]
        })
        .eq('id', proposalId)

    if (updateError) throw updateError
}

export async function saveProposalItems(proposalId: string, items: any[], total: number) {
    const supabase = await createClient()

    // 1. Clear old items
    const { error: delError } = await supabase
        .from('ItemProposta')
        .delete()
        .eq('proposta_id', proposalId)
    if (delError) throw delError

    // 2. Insert new items
    if (items && items.length > 0) {
        const itemsToInsert = items.map((item: any, index: number) => ({
            proposta_id: proposalId,
            nome_ambiente: item.nome_ambiente || item.name, // Handle both DB and Frontend prop names
            largura: item.largura || item.width,
            altura: item.altura || item.height,
            // area_m2: item.area_m2 || item.area, // Generated column
            valor_unitario: item.valor_unitario || 28.00,
            valor_total: item.valor_total || item.price,
            ordem: index
        }))

        const { error: itemError } = await supabase
            .from('ItemProposta')
            .insert(itemsToInsert)
        if (itemError) throw itemError
    }

    // 3. Update Proposal Total
    const { error: updateError } = await supabase
        .from('Proposta')
        .update({
            total_geral: total
        })
        .eq('id', proposalId)

    if (updateError) throw updateError
}
