'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowRightLeft, Copy, Check } from 'lucide-react'
import { translateAction } from '@/actions/translate'

export function Translator() {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState('')
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleTranslate = async () => {
        if (!input.trim()) return

        setLoading(true)
        try {
            const result = await translateAction(input)
            if (result.success && result.data) {
                setOutput(result.data)
            } else {
                alert('Erro ao traduzir')
            }
        } catch (error) {
            console.error(error)
            alert('Erro ao traduzir')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        if (!output) return
        navigator.clipboard.writeText(output)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                    Traductor ES ↔ PT (Madrid)
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
                <div className="space-y-2">
                    <Textarea
                        placeholder="Escribe en Español ou Português..."
                        className="min-h-[100px] resize-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleTranslate()
                            }
                        }}
                    />
                </div>

                <Button
                    onClick={handleTranslate}
                    disabled={loading || !input.trim()}
                    className="w-full"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {loading ? 'Traduciendo...' : 'Traducir / Adaptar'}
                </Button>

                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-md p-3 relative group min-h-[100px]">
                    {output ? (
                        <p className="text-sm whitespace-pre-wrap">{output}</p>
                    ) : (
                        <p className="text-sm text-gray-400 italic text-center mt-8">
                            La traducción aparecerá aquí...
                        </p>
                    )}

                    {output && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-8 w-8 bg-white/50 hover:bg-white shadow-sm"
                            onClick={handleCopy}
                        >
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
