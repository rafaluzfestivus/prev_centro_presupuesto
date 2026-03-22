'use server'

import { OpenAI } from 'openai'

const TRANSLATOR_SYSTEM_PROMPT = `
Você é o motor de comunicação oficial da Preventiva Centro em Madrid. Sua função é atuar como a voz do Rafael (Rafa) na tradução entre Português do Brasil e o Espanhol castiço de Madrid.

DIRETRIZES DE PERSONALIDADE E ESTILO:
Linguagem de Madrid: Use o "Tuteo" e termos locais como "Vale", "Venga", ou "Qué pasa" quando apropriado para o contexto de instalação de redes.

Foco no Negócio: Você entende de redes de proteção para crianças, pets (gatos) e sistemas anti-pombos. Use termos técnicos corretos em espanhol (ex: redes de protección, mallas, antipalomas).

Tom Descontraído: Mantenha a fala natural e informal, como um prestador de serviço ágil e direto de Madrid.

REGRAS ESTRITAS:
SEM SINAIS INVERTIDOS: É proibido o uso de ¿ ou ¡. Use apenas a pontuação padrão do Português/Inglês.

OUTPUT LIMPO: Entregue apenas a tradução. Não adicione "Tradução:", comentários ou aspas.

TRADUÇÃO DIRETA: Se o input for Português (BR), traduza para Espanhol (Madrid). Se for Espanhol, traduza para Português (BR).

CADA MENSAGEM É INDEPENDENTE: Trate cada input como uma mensagem isolada, sem relação com mensagens anteriores.
`

async function attemptTranslation(openai: OpenAI, text: string): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: TRANSLATOR_SYSTEM_PROMPT },
            { role: "user", content: text }
        ],
        temperature: 0.0,
        max_tokens: 1000,
    })

    const result = completion.choices[0].message.content
    if (!result || result.trim().length === 0) {
        throw new Error('Respuesta vacía del servicio de traducción')
    }
    return result
}

export async function translateAction(text: string) {
    if (!text || text.trim().length === 0) return { success: false, error: 'Texto vacío' }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const maxAttempts = 3
    const delays = [1000, 2000, 4000]

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const translatedText = await attemptTranslation(openai, text)
            return { success: true, data: translatedText }
        } catch (error: any) {
            const isLast = attempt === maxAttempts - 1
            const isRetryable = error?.status === 429 || error?.status >= 500 || error?.code === 'ECONNRESET'

            if (isLast || !isRetryable) {
                console.error(`Translation error (attempt ${attempt + 1}):`, error)
                return {
                    success: false,
                    error: error?.status === 429
                        ? 'Servicio ocupado, intenta de nuevo en unos segundos'
                        : 'Error en la traducción'
                }
            }

            await new Promise(resolve => setTimeout(resolve, delays[attempt]))
        }
    }

    return { success: false, error: 'Error en la traducción' }
}
