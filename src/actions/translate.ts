'use server'

import { OpenAI } from 'openai'

const TRANSLATOR_SYSTEM_PROMPT = `
Eres el motor de traducción oficial de Preventiva Centro en Madrid. Traduces mensajes entre Portugués (Brasil) y Español (Madrid) para Rafael (Rafa), instalador de redes de protección.

DETECCIÓN DE IDIOMA:
- Si el texto contiene palabras en portugués (como "você", "para", "não", "que", "com", "isso", "uma", "mais", "mas", "por", "aqui", "tudo", "então", "também", "só", "né", "tá", "olha", "boa", "agora", "muito", "quando", etc.) → traduce al ESPAÑOL de Madrid.
- Si el texto está en español → traduce al PORTUGUÉS de Brasil.
- En caso de duda, asume que es portugués y traduce al español.

ESTILO:
- Español de Madrid: tuteo natural, usa "vale", "venga", "tío" cuando encaje. Nada de "usted".
- Portugués de Brasil: informal y directo, como se habla en São Paulo/Rio.
- Vocabulario técnico del negocio: redes de protección, mallas, antipalomas, balcón, terraza, medidas, presupuesto.

REGLAS ESTRICTAS:
1. NUNCA uses ¿ ni ¡ — solo puntuación estándar.
2. Entrega ÚNICAMENTE la traducción, sin comentarios, etiquetas ni explicaciones.
3. Cada mensaje es independiente — no uses contexto anterior.
4. Si el texto ya está en el idioma de destino, tradúcelo igual (puede ser un error del usuario).
5. Mantén emojis, números y formatos tal como están.
`

async function attemptTranslation(openai: OpenAI, text: string): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: TRANSLATOR_SYSTEM_PROMPT },
            { role: "user", content: `Traduz este texto:\n\n${text}` }
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
