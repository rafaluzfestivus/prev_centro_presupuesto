'use server'

import { createProposal, getProposals, getProposalById, getLatestAIProcessing, getProposalItems, saveAIProcessing, updateProposal, saveProposalItems } from '@/services/proposal'
import { CreateProposalInput } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { OpenAI } from 'openai'
import { SYSTEM_PROMPT } from '@/services/ai/prompt'

export async function createProposalAction(data: CreateProposalInput) {
    try {
        // TODO: Get real user ID from auth
        // const { userId } = auth() 
        const userId = '00000000-0000-0000-0000-000000000000' // Mock or undefined for now if auth not strict

        // Actually, we should check if we have a user. If anon, maybe explicit null?
        // creating with null for now as we might not have auth setup in this context fully verified

        const proposal = await createProposal(data)
        revalidatePath('/painel')
        return { success: true, id: proposal.id }
    } catch (error) {
        console.error('Failed to create proposal:', error)
        return { success: false, error: 'Failed to create proposal' }
    }
}

export async function getProposalsAction() {
    try {
        const proposals = await getProposals()
        return { success: true, data: proposals }
    } catch (error) {
        console.error('Failed to fetch proposals:', error)
        return { success: false, error: 'Failed to fetch proposals' }
    }
}

export async function getProposalDetailsAction(id: string) {
    try {
        const proposal = await getProposalById(id)
        const items = await getProposalItems(id)
        const processing = await getLatestAIProcessing(id)

        return { success: true, data: { proposal, items, processing } }
    } catch (error) {
        console.error('Failed to fetch proposal details:', error)
        return { success: false, error: 'Failed to fetch proposal details' }
    }
}

export async function processProposalWithAIAction(id: string, instruction?: string, currentCtx?: any) {
    try {
        const proposal = await getProposalById(id)

        // --- AI LOGIC START ---
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT }
        ]

        if (currentCtx) {
            messages.push({
                role: "user",
                content: `Contexto Atual da Proposta (JSON): ${JSON.stringify(currentCtx)}. \n\n Instrução de Alteração: ${instruction}`
            })
        } else {
            messages.push({ role: "user", content: proposal.medidas_input })
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.1,
        })
        const content = completion.choices[0].message.content
        if (!content) throw new Error("No AI content")

        const result = JSON.parse(content)
        // --- AI LOGIC END ---

        // Save to DB
        await saveAIProcessing(id, result, instruction || proposal.medidas_input, result.items)

        revalidatePath(`/proposal/${id}`)
        return { success: true, data: result }

    } catch (error) {
        console.error('Failed to process proposal:', error)
        return { success: false, error: 'Failed to process proposal' }
    }
}

export async function confirmProposalAction(id: string, total: number, items: any[]) {
    try {
        // Save manual edits first
        await saveProposalItems(id, items, total)

        // Then confirm status
        await updateProposal(id, {
            status: 'Confirmada',
            data_confirmacao: new Date().toISOString()
        })
        revalidatePath(`/proposal/${id}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to confirm:', error)
        return { success: false, error: 'Failed to confirm' }
    }
}

export async function updateProposalAction(id: string, updates: any) {
    try {
        await updateProposal(id, updates)
        revalidatePath(`/proposal/${id}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to update proposal:', error)
        return { success: false, error: 'Failed to update proposal' }
    }
}
