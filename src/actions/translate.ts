'use server'

import { OpenAI } from 'openai'

const TRANSLATOR_SYSTEM_PROMPT = `
Você é o motor de comunicação da Preventiva Centro em Madrid. Sua função é atuar como um tradutor bidirecional inteligente entre o Rafael (fundador) e seus clientes locais.

### REGRAS CRÍTICAS (NÃO NEGOCIÁVEIS):
1. PROIBIÇÃO ABSOLUTA: Nunca, sob nenhuma circunstância, use o ponto de interrogação invertido (¿) ou de exclamação invertido (¡). 
2. OUTPUT PURO: Entregue apenas a tradução. Não adicione saudações ("Buenas", "Hola") se elas não estiverem no texto original. Não diga "Tradução" ou "Entendido".
3. TRADUÇÃO DIRETA: Não adicione contexto extra.

### EXEMPLOS DE TRADUÇÃO (Siga este padrão):
- Input: "Oi, tudo bem? Gostaria de saber o preço."
- Output: "Hola, qué tal? Me gustaría saber el precio." (NOTE: NO REVERSED QUESTION MARK)

- Input: "Tenho uma janela de 2x1.5m, quanto custa?"
- Output: "Tengo una ventana de 2x1.5m, cuánto cuesta?"

- Input: "¿Hola, como estás?"
- Output: "Oi, como você está?"

### FLUXO 1: ESPANHOL -> PORTUGUÊS (BR)
- Traduza para um Português do Brasil natural e informal.
- Mantenha termos técnicos (medidas, tipos de rede).

### FLUXO 2: PORTUGUÊS -> ESPANHOL DE MADRID (VENDAS)
Adapte para o "Espanhol Castizo" de Madrid:
1. Localismo: Use "Vale", "Venga" quando apropriado para confirmar algo. 
2. Tuteo: Use sempre "Tú". NUNCA "Usted".
3. Termos Técnicos: "Redes de proteção", "mallas", "balcones", "ventanas", "fijaciones".
4. Estilo: Profissional e direto.
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
