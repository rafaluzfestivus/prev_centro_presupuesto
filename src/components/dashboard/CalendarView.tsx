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
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CalendarView = () => {
    const supabase = createClient();
    const searchParams = useSearchParams();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        client_name: '',
        whatsapp: '',
        date_start: '',
        status: 'confirmed',
        attachment_url: ''
    });

    // Handle pre-fill from URL
    useEffect(() => {
        const clientParam = searchParams.get('client');
        const whatsappParam = searchParams.get('whatsapp');
        if (clientParam || whatsappParam) {
            setFormData(prev => ({
                ...prev,
                client_name: clientParam || '',
                whatsapp: whatsappParam || ''
            }));
            setIsModalOpen(true);
        }
    }, [searchParams]);

    const fetchAppointments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('appointments')
            .select('*, clients(name, whatsapp, location)')
            .order('date_start', { ascending: true });

        if (error) console.error('Error fetching appointments:', error);
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
        setFormData({ ...formData, date_start: `${dateStr}T09:00` });
        setSelectedAppointment(null);
        setIsModalOpen(true);
    };

    const handleAppointmentClick = (e: React.MouseEvent, apt: any) => {
        e.stopPropagation();
        setSelectedAppointment(apt);
        setFormData({
            client_name: apt.clients?.name || '',
            whatsapp: apt.clients?.whatsapp || '',
            date_start: format(new Date(apt.date_start || apt.scheduled_at), "yyyy-MM-dd'T'HH:mm"),
            status: apt.status,
            attachment_url: apt.attachment_url || ''
        });
        setIsModalOpen(true);
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
            alert('Error en la carga: ' + error.message);
        } else {
            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(fileName);
            setFormData({ ...formData, attachment_url: publicUrl });
        }
        setUploading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanWhatsApp = formData.whatsapp.replace(/\D/g, '');
        if (!cleanWhatsApp) return alert('Por favor, insira um WhatsApp válido.');

        // 1. Manage Client
        let clientId;
        const { data: existingClients } = await supabase
            .from('clients')
            .select('id')
            .eq('whatsapp', cleanWhatsApp);

        if (existingClients && existingClients.length > 0) {
            clientId = existingClients[0].id;
            // Update name if changed
            await supabase.from('clients').update({ name: formData.client_name }).eq('id', clientId);
        } else {
            const { data: newClient, error: insertError } = await supabase.from('clients').insert({
                whatsapp: cleanWhatsApp,
                name: formData.client_name || 'Cliente Manual',
                source: 'manual'
            }).select('id').single();

            if (insertError) return alert('Error al crear cliente: ' + insertError.message);
            clientId = newClient?.id;
        }

        if (!clientId) return alert('Error al identificar cliente.');

        // 2. Insert or Update Appointment
        let error;
        if (selectedAppointment) {
            const { error: updateError } = await supabase
                .from('appointments')
                .update({
                    client_id: clientId,
                    date_start: formData.date_start || new Date().toISOString(),
                    date_end: formData.date_start || new Date().toISOString(),
                    scheduled_at: formData.date_start || new Date().toISOString(),
                    status: formData.status,
                    attachment_url: formData.attachment_url
                })
                .eq('id', selectedAppointment.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('appointments')
                .insert({
                    client_id: clientId,
                    date_start: formData.date_start || new Date().toISOString(),
                    date_end: formData.date_start || new Date().toISOString(),
                    scheduled_at: formData.date_start || new Date().toISOString(),
                    status: formData.status,
                    attachment_url: formData.attachment_url
                });
            error = insertError;
        }

        if (error) {
            alert('Error: ' + error.message);
        } else {
            setIsModalOpen(false);
            resetForm();
            fetchAppointments();
        }
    };

    const handleDelete = async () => {
        if (!selectedAppointment || !confirm('¿Estás seguro de que quieres cancelar esta cita?')) return;

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', selectedAppointment.id);

        if (error) {
            alert('Error al cancelar: ' + error.message);
        } else {
            setIsModalOpen(false);
            resetForm();
            fetchAppointments();
        }
    };

    const resetForm = () => {
        setFormData({
            client_name: '',
            whatsapp: '',
            date_start: '',
            status: 'confirmed',
            attachment_url: ''
        });
        setSelectedAppointment(null);
    };

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-6">
                    <h2 className="text-2xl font-bold capitalize text-navy">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"><ChevronLeft size={20} /></button>
                        <button onClick={nextMonth} className="p-2 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-5 py-3 bg-accent text-navy font-bold rounded-xl hover:shadow-lg transition-all"
                >
                    <Plus size={20} />
                    Agendar Visita
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
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
                    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.date_start || apt.scheduled_at), day));

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
                                        onClick={(e) => handleAppointmentClick(e, apt)}
                                        className={`text-[10px] p-1.5 rounded flex flex-col border-l-2 transition-transform hover:scale-105 ${apt.status === 'pending' ? 'bg-gray-100 border-gray-400' : 'bg-bg-dark border-accent'
                                            }`}
                                        title={`${format(new Date(apt.date_start || apt.scheduled_at), 'HH:mm')} - ${apt.clients?.name || 'Cliente'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-navy">{format(new Date(apt.date_start || apt.scheduled_at), 'HH:mm')}</span>
                                            {apt.attachment_url && <ShieldCheck size={10} className="text-accent" />}
                                        </div>
                                        <span className="truncate opacity-70 font-medium">{apt.clients?.name || 'Cliente'}</span>
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
                <h1 className="text-3xl font-bold mb-2">Agenda de <span className="accent-text">Instalaciones</span></h1>
                <p className="text-text-muted">Cronograma mensual de visitas técnicas e instalaciones.</p>
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
                            <h2 className="text-2xl font-bold text-navy">{selectedAppointment ? 'Editar Cita' : 'Nueva Cita'}</h2>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-text-muted hover:text-navy transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">Nombre del Cliente</label>
                                <input
                                    type="text" required value={formData.client_name}
                                    onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                                    placeholder="Nombre completo"
                                    className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">WhatsApp / Teléfono</label>
                                <input
                                    type="text" required value={formData.whatsapp}
                                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                                    placeholder="Ej: 34600000000"
                                    className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">Fecha y Hora</label>
                                    <input
                                        type="datetime-local" required value={formData.date_start}
                                        onChange={e => setFormData({ ...formData, date_start: e.target.value })}
                                        className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none text-xs appearance-none"
                                    >
                                        <option value="pending">Pendiente</option>
                                        <option value="confirmed">Confirmada</option>
                                        <option value="completed">Completada</option>
                                        <option value="cancelled">Cancelada</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">Documento / Presupuesto</label>
                                <div className="p-4 border-2 border-dashed border-border rounded-xl bg-bg-dark/50">
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-accent file:text-navy hover:file:bg-accent/80 cursor-pointer"
                                    />
                                    {uploading && <p className="mt-2 text-xs font-bold text-accent animate-pulse">Subiendo...</p>}
                                    {formData.attachment_url && (
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-green-600 font-bold">
                                                <CheckCircle size={14} /> Archivo listo
                                            </div>
                                            <a href={formData.attachment_url} target="_blank" rel="noreferrer" className="text-[10px] text-accent underline font-black uppercase">Ver Documento</a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="w-full py-4 bg-accent text-navy font-black rounded-xl hover:shadow-xl transition-all disabled:opacity-50 text-base shadow-sm"
                                >
                                    {selectedAppointment ? 'Actualizar Cita' : 'Confirmar Cita'}
                                </button>

                                {selectedAppointment && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all text-sm border border-red-100"
                                    >
                                        Cancelar / Eliminar Cita
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;
