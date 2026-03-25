'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Translator } from '@/components/dashboard/Translator'
import { MessageSquareText, X } from 'lucide-react'

export function FloatingTranslator() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-4">
            {isOpen && (
                <div className="w-[calc(100vw-2rem)] sm:w-[350px] shadow-2xl rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-10 fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 relative">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-8 w-8 z-10 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        <Translator />
                    </div>
                </div>
            )}

            <Button
                onClick={() => setIsOpen(!isOpen)}
                className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white p-0 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            >
                {isOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    <MessageSquareText className="h-6 w-6" />
                )}
            </Button>
        </div>
    )
}
