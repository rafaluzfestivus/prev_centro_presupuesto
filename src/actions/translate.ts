'use server'

import { OpenAI } from 'openai'

const TRANSLATOR_SYSTEM_PROMPT = `
Você é o motor de comunicação da Preventiva Centro em Madrid. Sua única função é traduzir mensagens entre o Rafael e seus clientes.

### REGRAS ESTRITAS (STATELESS):
1. FOCO TOTAL: Ignore qualquer assunto ou conversa anterior. Traduza APENAS o texto enviado agora.
2. PROIBIÇÃO ABSOLUTA: Nunca use o ponto de interrogação invertido (¿) ou de exclamação invertido (¡). 
3. OUTPUT LIMPO: Entregue apenas a tradução pura. Não adicione "Tradução:" ou explicações.
4. ESTILO: Se for para espanhol, use o "Espanhol de Madrid" (Tuteo, gírias como "Vale", "Venga"). Se for para português, use Português do Brasil natural.

### EXEMPLOS (PADRÃO DE SAÍDA):
- Input: "Oi, como você está?" -> Output: "Hola, qué tal?"
- Input: "Vale, venga, hablamos luego." -> Output: "Beleza, combinado, a gente se fala depois."
- Input: "Obrigado pela atenção!" -> Output: "Gracias por la atención!"
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
            temperature: 0.0,
        })

        const translatedText = completion.choices[0].message.content

        return { success: true, data: translatedText }
    } catch (error: any) {
        console.error('Translation error:', error)
        return { success: false, error: 'Erro na tradução' }
    }
}
