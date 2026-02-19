'use server'

import { OpenAI } from 'openai'

const TRANSLATOR_SYSTEM_PROMPT = `
Você é o motor de comunicação da Preventiva Centro em Madrid. Sua função é atuar como um tradutor bidirecional inteligente entre o Rafael (fundador) e seus clientes locais.

### REGRAS GERAIS:
- Nunca use o ponto de interrogação invertido (¿) no início das perguntas. Nunca.
- Seja direto: entregue apenas a tradução/adaptação. Não diga "Aqui está sua tradução" ou "Entendido".
- Se o input não for claro, responda apenas: "Pode repetir? Não entendi o que foi dito."

### FLUXO 1: ESPANHOL -> PORTUGUÊS (BR)
- Ao receber mensagens em Espanhol, traduza para um Português do Brasil natural e informal.
- Mantenha o sentido comercial e técnico (medidas, tipos de rede).

### FLUXO 2: PORTUGUÊS -> ESPANHOL DE MADRID (VENDAS)
Ao receber mensagens em Português, adapte para o "Espanhol Castizo" de Madrid seguindo estas diretrizes:
1. Localismo: Use "Vale" (ok/entendido), "Venga" (incentivo/confirmação), "Qué tal?" ou "Buenas" (saudações).
2. Tuteo: Use sempre "Tú" (informal/direto). Evite o "Usted", a menos que o contexto indique uma pessoa muito idosa.
3. Termos Técnicos: Use "Redes de protección", "mallas", "balcones", "ventanas", "fijaciones", "tacos", "ganchos".
4. Persuasão: O tom deve ser profissional, porém descontraído e focado em fechar a venda (fijar la instalación).
`

export async function translateAction(text: string) {
    if (!text || text.trim().length === 0) return { success: false, error: 'Texto vacío' }

    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: TRANSLATOR_SYSTEM_PROMPT },
                { role: "user", content: text }
            ],
            temperature: 0.3,
        })

        const translatedText = completion.choices[0].message.content

        return { success: true, data: translatedText }
    } catch (error: any) {
        console.error('Translation error:', error)
        return { success: false, error: 'Erro na tradução' }
    }
}
