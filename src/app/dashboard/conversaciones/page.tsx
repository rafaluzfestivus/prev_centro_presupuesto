'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createClient } from '@/lib/supabase/client'
import {
    getContactsWithLastMessageAction,
    getClientMessagesAction,
    sendMessageAction,
    type ConversationContact,
    type Message,
} from '@/actions/conversations'
import NextImage from 'next/image'
import {
    Search, Send, MessageSquare, Phone, ArrowLeft,
    Check, CheckCheck, Image as ImageIcon, RefreshCw, Wifi, WifiOff
} from 'lucide-react'

function formatTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Ayer'
    if (diffDays < 7) return d.toLocaleDateString('es-ES', { weekday: 'short' })
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

function MessageBubble({ msg }: { msg: Message }) {
    const isOut = msg.direction === 'outbound'
    return (
        <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1`}>
            <div className={`max-w-[75%] px-3 py-2 rounded-2xl shadow-sm text-sm relative ${isOut
                ? 'bg-[#dcf8c6] text-gray-800 rounded-br-sm'
                : 'bg-white text-gray-800 rounded-bl-sm'
                }`}>
                {msg.mediaType === 'image' && msg.mediaUrl && (
                    <NextImage src={msg.mediaUrl} alt="imagem" width={300} height={200} className="rounded-lg mb-1 max-w-full" />
                )}
                {msg.mediaType === 'document' && (
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <ImageIcon size={14} />
                        <span className="text-xs">Documento</span>
                    </div>
                )}
                <span className="pr-14">{msg.message}</span>
                <span className={`absolute bottom-1 right-2 text-[10px] flex items-center gap-0.5 ${isOut ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formatTime(msg.createdAt)}
                    {isOut && (
                        msg.status === 'read'
                            ? <CheckCheck size={12} className="text-blue-500" />
                            : <Check size={12} />
                    )}
                </span>
            </div>
        </div>
    )
}

function ContactItem({ contact, active, onClick }: { contact: ConversationContact; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left ${active ? 'bg-gray-100' : ''}`}
        >
            <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center font-black text-lg shrink-0">
                {(contact.name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-gray-900 text-sm truncate">{contact.name}</span>
                    <span className={`text-[10px] shrink-0 ml-2 ${contact.unread > 0 ? 'text-[#25d366] font-bold' : 'text-gray-400'}`}>
                        {formatTime(contact.lastMessageAt)}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    <span className="text-xs text-gray-500 truncate">
                        {contact.lastDirection === 'outbound' && <span className="text-gray-400 mr-0.5">✓</span>}
                        {contact.lastMessage || <span className="italic text-gray-400">Sem mensagem</span>}
                    </span>
                    {contact.unread > 0 && (
                        <span className="ml-2 shrink-0 bg-[#25d366] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {contact.unread > 9 ? '9+' : contact.unread}
                        </span>
                    )}
                </div>
            </div>
        </button>
    )
}

export default function ConversacionesPage() {
    const supabase = createClient()
    const [contacts, setContacts] = useState<ConversationContact[]>([])
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<ConversationContact | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [loadingContacts, setLoadingContacts] = useState(true)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [showChat, setShowChat] = useState(false) // mobile: toggle between list/chat
    const [connected, setConnected] = useState<boolean | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const loadContacts = useCallback(async () => {
        setLoadingContacts(true)
        const res = await getContactsWithLastMessageAction()
        if (res.success && res.data) {
            setContacts(res.data)
        }
        setLoadingContacts(false)
    }, [])

    const loadMessages = useCallback(async (contact: ConversationContact) => {
        setLoadingMessages(true)
        const res = await getClientMessagesAction(contact.clientId)
        if (res.success && res.data) {
            setMessages(res.data)
            // Reset unread counter locally
            setContacts(prev => prev.map(c =>
                c.clientId === contact.clientId ? { ...c, unread: 0 } : c
            ))
        }
        setLoadingMessages(false)
    }, [])

    useEffect(() => { loadContacts() }, [loadContacts]) // eslint-disable-line react-hooks/set-state-in-effect

    // Check Evolution API connection status
    useEffect(() => {
        fetch('/api/wa/status')
            .then(r => r.json() as Promise<{ connected: boolean }>)
            .then(d => setConnected(d.connected))
            .catch(() => setConnected(false))
    }, [])

    // Filter contacts by search (derived state via useMemo)
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return contacts
        return contacts.filter(c =>
            c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.lastMessage.toLowerCase().includes(q)
        )
    }, [search, contacts])

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Supabase Realtime: listen for new messages
    useEffect(() => {
        const channel = supabase
            .channel('conversations-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
                const row = payload.new as Record<string, string>
                // Update contacts list
                loadContacts()
                // If this message belongs to the selected contact, add it
                if (selected && row.client_id === selected.clientId) {
                    const newMsg: Message = {
                        id: row.id,
                        message: row.message ?? '',
                        direction: row.direction as 'inbound' | 'outbound',
                        status: row.status,
                        createdAt: row.created_at,
                        mediaUrl: row.media_url ?? null,
                        mediaType: row.media_type ?? null,
                        pushName: row.push_name ?? null,
                    }
                    setMessages(prev => [...prev, newMsg])
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [selected, supabase, loadContacts])

    const selectContact = (contact: ConversationContact) => {
        setSelected(contact)
        loadMessages(contact)
        setShowChat(true)
    }

    const handleSend = async () => {
        if (!input.trim() || !selected || sending) return
        const text = input.trim()
        setInput('')
        setSending(true)

        // Optimistic update
        const optimistic: Message = {
            id: `temp-${Date.now()}`,
            message: text,
            direction: 'outbound',
            status: 'sent',
            createdAt: new Date().toISOString(),
            mediaUrl: null,
            mediaType: null,
            pushName: null,
        }
        setMessages(prev => [...prev, optimistic])

        const res = await sendMessageAction(selected.clientId, selected.phone, text)
        if (!res.success) {
            setMessages(prev => prev.filter(m => m.id !== optimistic.id))
            alert('Erro ao enviar: ' + res.error)
        }
        setSending(false)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-navy">
                            Conversaciones <span className="accent-text">WhatsApp</span>
                        </h1>
                        <div className="flex items-center gap-1.5 mt-1">
                            {connected === null ? (
                                <span className="text-xs text-gray-400">Verificando conexão...</span>
                            ) : connected ? (
                                <><Wifi size={12} className="text-green-500" /><span className="text-xs text-green-600 font-medium">Conectado</span></>
                            ) : (
                                <><WifiOff size={12} className="text-red-400" /><span className="text-xs text-red-500 font-medium">Desconectado — configure a Evolution API</span></>
                            )}
                        </div>
                    </div>
                    <button onClick={loadContacts} className="p-2 bg-white border border-border rounded-xl text-navy hover:bg-gray-50">
                        <RefreshCw size={18} className={loadingContacts ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Main chat layout */}
                <div className="flex flex-1 rounded-2xl border border-border overflow-hidden bg-white shadow-sm min-h-0">

                    {/* LEFT: Contact list */}
                    <div className={`w-full sm:w-80 md:w-96 flex-shrink-0 flex flex-col border-r border-gray-200 ${showChat ? 'hidden sm:flex' : 'flex'}`}>
                        {/* Search */}
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar conversación..."
                                    className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-accent"
                                />
                            </div>
                        </div>

                        {/* Contact list */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingContacts ? (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    <RefreshCw className="animate-spin inline-block mb-2" size={20} />
                                    <p>Cargando conversaciones...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">Nenhuma conversa ainda</p>
                                    <p className="text-xs mt-1 text-gray-300">As mensagens do WhatsApp aparecerão aqui</p>
                                </div>
                            ) : (
                                filtered.map(c => (
                                    <ContactItem
                                        key={c.clientId}
                                        contact={c}
                                        active={selected?.clientId === c.clientId}
                                        onClick={() => selectContact(c)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Chat panel */}
                    <div className={`flex-1 flex flex-col min-w-0 ${showChat ? 'flex' : 'hidden sm:flex'}`}
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.4\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#efeae2' }}>

                        {!selected ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                                    <MessageSquare size={36} className="text-gray-300" />
                                </div>
                                <p className="font-semibold text-gray-500">Seleciona una conversación</p>
                                <p className="text-sm mt-1 text-gray-400">Elige un contacto para ver los mensajes</p>
                            </div>
                        ) : (
                            <>
                                {/* Chat header */}
                                <div className="bg-[#f0f2f5] border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                                    <button onClick={() => setShowChat(false)} className="sm:hidden p-1 rounded-lg hover:bg-gray-200">
                                        <ArrowLeft size={20} className="text-gray-600" />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-black">
                                        {(selected.name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900 text-sm">{selected.name}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <Phone size={10} />
                                            {selected.phone}
                                        </p>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-4 py-4">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center h-full">
                                            <RefreshCw className="animate-spin text-gray-400" size={24} />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                            Nenhuma mensagem ainda
                                        </div>
                                    ) : (
                                        messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                                    )}
                                    <div ref={bottomRef} />
                                </div>

                                {/* Input */}
                                <div className="bg-[#f0f2f5] border-t border-gray-200 px-4 py-3 flex items-end gap-3">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Escribe un mensaje..."
                                        rows={1}
                                        className="flex-1 resize-none bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent max-h-32 overflow-y-auto"
                                        style={{ lineHeight: '1.4' }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || sending}
                                        className="w-10 h-10 rounded-full bg-[#25d366] hover:bg-[#20c45a] text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
