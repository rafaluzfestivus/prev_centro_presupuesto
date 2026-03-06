
import { OpenAI } from 'openai'
import { NextResponse } from 'next/server'
import { SYSTEM_PROMPT } from '@/services/ai/prompt'
import { createClient } from '@/lib/supabase/server'

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

        // Fetch System Prompt from DB
        const supabase = await createClient()
        const { data: configData } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'system_prompt')
            .single()

        const activeSystemPrompt = `${configData?.value || SYSTEM_PROMPT}\n\nResponde sempre em formato JSON.`

        const messages: any[] = [
            { role: "system", content: activeSystemPrompt }
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

        // More robust cleaning: only split if looks like markdown
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```')) {
            const parts = cleanContent.split('```');
            const jsonPart = parts.find(p => p.includes('{') && p.includes('}'));
            if (jsonPart) {
                cleanContent = jsonPart.replace(/^json\n/, '').trim();
            }
        }

        let structuredData;
        try {
            structuredData = JSON.parse(cleanContent);
        } catch (e) {
            // If direct parse fails, try to extract anything between { and }
            const match = cleanContent.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    structuredData = JSON.parse(match[0]);
                } catch (e2) {
                    console.error("Failed to parse extracted JSON:", e2);
                    throw new Error("Formato JSON inválido recebido da IA");
                }
            } else {
                throw new Error("A IA não retornou um objeto JSON válido");
            }
        }

        return NextResponse.json(structuredData)
    } catch (error) {
        console.error('AI Processing Error:', error)
        return NextResponse.json(
            { error: 'Failed to process proposal', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
