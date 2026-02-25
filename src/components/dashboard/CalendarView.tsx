'use client'

import React, { useEffect, useState } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    eachDayOfInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const CalendarView = () => {
    const supabase = createClient();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [newApt, setNewApt] = useState({
        whatsapp: '',
        scheduled_at: '',
        status: 'confirmed',
        attachment_url: ''
    });

    const fetchAppointments = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('appointments')
            .select('*, clients(name, whatsapp, location)')
            .order('scheduled_at', { ascending: true });

        setAppointments(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const onDateClick = (day: Date) => {
        setSelectedDate(day);
        const dateStr = format(day, "yyyy-MM-dd");
        setNewApt({ ...newApt, scheduled_at: `${dateStr}T09:00` });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const fileName = `${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
            .from('attachments')
            .upload(fileName, file);

        if (error) {
            alert('Erro no upload: ' + error.message);
        } else {
            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(fileName);
            setNewApt({ ...newApt, attachment_url: publicUrl });
        }
        setUploading(false);
    };

    const handleAddAppointment = async (e: React.FormEvent) => {
        e.preventDefault();

        const { data: clients } = await supabase.from('clients').select('id').eq('whatsapp', newApt.whatsapp);
        let clientId;

        if (clients && clients.length > 0) {
            clientId = clients[0].id;
        } else {
            const { data: newClient } = await supabase.from('clients').insert({
                whatsapp: newApt.whatsapp,
                name: 'Cliente Manual',
                source: 'manual'
            }).select('id').single();
            clientId = newClient?.id;
        }

        if (!clientId) return alert('Erro ao identificar cliente.');

        const { error } = await supabase.from('appointments').insert({
            client_id: clientId,
            scheduled_at: newApt.scheduled_at,
            status: newApt.status,
            attachment_url: newApt.attachment_url
        });

        if (error) {
            alert('Erro ao agendar: ' + error.message);
        } else {
            setIsModalOpen(false);
            setNewApt({ whatsapp: '', scheduled_at: '', status: 'confirmed', attachment_url: '' });
            fetchAppointments();
        }
    };

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-6">
                    <h2 className="text-2xl font-bold capitalize text-navy">
                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"><ChevronLeft size={20} /></button>
                        <button onClick={nextMonth} className="p-2 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-accent text-navy font-bold rounded-xl hover:shadow-lg transition-all"
                >
                    <Plus size={20} />
                    Agendar Visita
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return (
            <div className="grid grid-cols-7 mb-2 border-b border-border">
                {days.map(day => (
                    <div key={day} className="text-center text-text-muted text-[10px] font-bold py-3 uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

        return (
            <div className="grid grid-cols-7 border-l border-t border-border rounded-xl overflow-hidden shadow-sm">
                {calendarDays.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());
                    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.scheduled_at), day));

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => onDateClick(day)}
                            className={`min-h-[140px] p-4 bg-white border-r border-b border-border cursor-pointer transition-all ${isSelected ? 'bg-accent/5 ring-1 ring-inset ring-accent/30' : 'hover:bg-gray-50'
                                }`}
                            style={{ opacity: isCurrentMonth ? 1 : 0.3 }}
                        >
                            <span className={`block text-sm mb-3 ${isToday ? 'w-7 h-7 bg-accent text-navy rounded-full flex items-center justify-center font-bold' : 'font-medium text-navy'
                                }`}>
                                {format(day, 'd')}
                            </span>
                            <div className="space-y-1.5">
                                {dayAppointments.map((apt, idx) => (
                                    <div
                                        key={idx}
                                        className="text-[10px] p-1.5 bg-bg-dark rounded flex flex-col border-l-2 border-accent"
                                        title={`${format(new Date(apt.scheduled_at), 'HH:mm')} - ${apt.clients?.name || 'Cliente'}`}
                                    >
                                        <span className="font-bold text-navy">{format(new Date(apt.scheduled_at), 'HH:mm')}</span>
                                        <span className="truncate opacity-70">{apt.clients?.name || 'Cliente'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="calendar-container">
            <header className="mb-10">
                <h1 className="text-3xl font-bold mb-2">Agenda de <span className="accent-text">Instalações</span></h1>
                <p className="text-text-muted">Cronograma mensal de visitas técnicas e instalações.</p>
            </header>

            <div className="glass-card p-10 mt-6 bg-white shadow-xl border-none">
                {renderHeader()}
                <div className="bg-white rounded-xl overflow-hidden">
                    {renderDays()}
                    {renderCells()}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-card w-full max-w-md p-10 bg-white border-none shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-navy">Nova Visita</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-navy transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddAppointment} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">WhatsApp do Cliente</label>
                                <input
                                    type="text" required value={newApt.whatsapp}
                                    onChange={e => setNewApt({ ...newApt, whatsapp: e.target.value })}
                                    placeholder="Ex: 34600000000"
                                    className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">Data e Hora</label>
                                <input
                                    type="datetime-local" required value={newApt.scheduled_at}
                                    onChange={e => setNewApt({ ...newApt, scheduled_at: e.target.value })}
                                    className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">Anexo / Orçamento</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-navy hover:file:bg-accent/80 cursor-pointer"
                                    />
                                    {uploading && <p className="mt-2 text-xs font-bold text-accent animate-pulse">Enviando documento...</p>}
                                    {newApt.attachment_url && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-green-600 font-bold">
                                            <CheckCircle size={14} /> Documento vinculado
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full py-4 bg-accent text-navy font-extrabold rounded-xl hover:shadow-xl transition-all disabled:opacity-50 text-lg"
                            >
                                Confirmar Agendamento
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;
