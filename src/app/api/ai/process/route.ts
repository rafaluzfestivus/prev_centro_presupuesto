
import { OpenAI } from 'openai'
import { NextResponse } from 'next/server'
import { SYSTEM_PROMPT } from '@/services/ai/prompt'

// Initialize OpenAI client

export async function POST(req: Request) {
    // Initialize OpenAI client inside the handler to prevent build-time errors if env var is missing
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })


    try {
        const { message, current_data } = await req.json()

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            )
        }

        const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: "Responde siempre en formato JSON." }
        ]

        if (current_data) {
            messages.push({
                role: "user",
                content: `Contexto Atual da Proposta (JSON): ${JSON.stringify(current_data)}. \n\n Instrução de Alteração: ${message}`
            })
        } else {
            messages.push({ role: "user", content: message })
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using a high-reasoning model for calculations
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.1, // Low temperature for consistent calculations
        })

        const content = completion.choices[0].message.content

        if (!content) {
            throw new Error("No content received from AI")
        }

        // Parse JSON to ensure it's valid before returning
        const structuredData = JSON.parse(content)

        return NextResponse.json(structuredData)
    } catch (error) {
        console.error('AI Processing Error:', error)
        return NextResponse.json(
            { error: 'Failed to process proposal', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
