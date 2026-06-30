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
    eachDayOfInterval,
    parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle, ShieldCheck, AlertCircle, Trash2, MapPin, Euro, Layers, ClipboardList, AlertTriangle, Lock, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';

const CalendarView = () => {
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useProfile();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [formError, setFormError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Blocked periods state
    const [blockedPeriods, setBlockedPeriods] = useState<any[]>([]);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [savingBlock, setSavingBlock] = useState(false);
    const [blockForm, setBlockForm] = useState({
        label: '',
        time_from: '13:00',
        time_to: '15:00',
        days_of_week: [] as number[], // empty = todos os dias
    });
    const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Form state
    const [formData, setFormData] = useState({
        client_name: '',
        whatsapp: '',
        date_start: '',
        status: 'confirmed',
        attachment_url: '',
        installation_address: '',
        total_value: '',
        total_m2: '',
        special_attention: false,
    });

    // Handle pre-fill from URL
    useEffect(() => {
        const clientParam = searchParams.get('client');
        const whatsappParam = searchParams.get('whatsapp');
        const addressParam = searchParams.get('address');
        const valueParam = searchParams.get('value');
        const m2Param = searchParams.get('m2');
        const dateParam = searchParams.get('date');
        if (clientParam || whatsappParam) {
            setFormData(prev => ({
                ...prev,
                client_name: clientParam || '',
                whatsapp: whatsappParam || '',
                ...(addressParam ? { installation_address: addressParam } : {}),
                ...(valueParam ? { total_value: valueParam } : {}),
                ...(m2Param ? { total_m2: m2Param } : {}),
                ...(dateParam ? { date_start: dateParam } : {}),
            }));
            setIsModalOpen(true);
        }
    }, [searchParams]);

    // Open specific appointment from URL ?apt=<id>
    useEffect(() => {
        const aptParam = searchParams.get('apt');
        if (aptParam && appointments.length > 0 && !isModalOpen) {
            const apt = appointments.find((a: any) => a.id === aptParam);
            if (apt) openAppointmentForEdit(apt);
        }
    }, [searchParams, appointments]);

    const fetchBlockedPeriods = async () => {
        let q = supabase.from('agenda_blocked_periods').select('*').order('time_from', { ascending: true });
        if (profile) q = q.eq('company_id', profile.company_id);
        const { data } = await q;
        setBlockedPeriods(data || []);
    };

    // Returns blocked periods applicable to a given day
    const getApplicableBlocks = (day: Date) => {
        const dow = day.getDay();
        return blockedPeriods.filter(b => {
            if (!b.is_active) return false;
            if (!b.days_of_week || b.days_of_week.length === 0) return true;
            return b.days_of_week.includes(dow);
        });
    };

    // HH:MM string comparison helper
    const timeInBlock = (hhmm: string, from: string, to: string) =>
        hhmm >= from.slice(0, 5) && hhmm < to.slice(0, 5);

    const fetchAppointments = async () => {
        setLoading(true);
        let q = supabase.from('appointments').select('*, clients(name, whatsapp, location)').order('date_start', { ascending: true });
        if (profile) q = q.eq('company_id', profile.company_id);
        const { data, error } = await q;

        if (error) console.error('Error fetching appointments:', error);
        setAppointments(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchAppointments();
        fetchBlockedPeriods();
    }, [profile]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const onDateClick = (day: Date) => {
        setSelectedDate(day);
        const dateStr = format(day, "yyyy-MM-dd");
        setFormData({ ...formData, date_start: `${dateStr}T09:00` });
        setSelectedAppointment(null);
        setFormError('');
        setShowDeleteConfirm(false);
        setIsModalOpen(true);
    };

    const openAppointmentForEdit = (apt: any) => {
        setSelectedAppointment(apt);
        const aptDate = apt.date_start ? parseISO(apt.date_start) : (apt.scheduled_at ? parseISO(apt.scheduled_at) : new Date());
        setFormData({
            client_name: apt.clients?.name || '',
            whatsapp: apt.clients?.whatsapp || '',
            date_start: format(aptDate, "yyyy-MM-dd'T'HH:mm"),
            status: apt.status,
            attachment_url: apt.attachment_url || '',
            installation_address: apt.installation_address || '',
            total_value: apt.total_value ? String(apt.total_value) : '',
            total_m2: apt.total_m2 ? String(apt.total_m2) : '',
            special_attention: apt.special_attention || false,
        });
        setFormError('');
        setShowDeleteConfirm(false);
        setIsModalOpen(true);
    };

    const handleAppointmentClick = (e: React.MouseEvent, apt: any) => {
        e.stopPropagation();
        openAppointmentForEdit(apt);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setFormError('');
        const fileName = `${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
            .from('attachments')
            .upload(fileName, file);

        if (error) {
            setFormError('Error al subir el archivo: ' + error.message);
        } else {
            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(fileName);
            setFormData({ ...formData, attachment_url: publicUrl });
        }
        setUploading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const cleanWhatsApp = formData.whatsapp.replace(/\D/g, '');
        if (!cleanWhatsApp) {
            setFormError('Por favor, inserte un WhatsApp válido.');
            return;
        }

        // Validate against blocked periods
        if (formData.date_start) {
            const aptDt = new Date(formData.date_start);
            const hhmm = `${String(aptDt.getHours()).padStart(2, '0')}:${String(aptDt.getMinutes()).padStart(2, '0')}`;
            const applicable = getApplicableBlocks(aptDt);
            const hit = applicable.find(b => timeInBlock(hhmm, b.time_from, b.time_to));
            if (hit) {
                setFormError(`Horario bloqueado: "${hit.label}" (${hit.time_from.slice(0,5)} – ${hit.time_to.slice(0,5)}). Escolha outro horário.`);
                return;
            }
        }

        // 1. Manage Client
        let clientId;
        const { data: existingClients } = await supabase
            .from('clients')
            .select('id')
            .eq('whatsapp', cleanWhatsApp)
            .eq('company_id', profile?.company_id ?? 1);

        if (existingClients && existingClients.length > 0) {
            clientId = existingClients[0].id;
            // Update name if changed
            await supabase.from('clients').update({ name: formData.client_name }).eq('id', clientId).eq('company_id', profile?.company_id ?? 1);
        } else {
            const { data: newClient, error: insertError } = await supabase.from('clients').insert({
                whatsapp: cleanWhatsApp,
                name: formData.client_name || 'Cliente Manual',
                source: 'manual',
                company_id: profile?.company_id ?? 1,
            }).select('id').single();

            if (insertError) {
                setFormError('Error al crear cliente: ' + insertError.message);
                return;
            }
            clientId = newClient?.id;
        }

        if (!clientId) {
            setFormError('Error al identificar cliente.');
            return;
        }

        // 2. Insert or Update Appointment
        let error;
        // Ensure ISO format for DB
        const isoDate = formData.date_start ? new Date(formData.date_start).toISOString() : new Date().toISOString();

        const aptPayload: any = {
            client_id: clientId,
            date_start: isoDate,
            date_end: isoDate,
            scheduled_at: isoDate,
            status: formData.status,
            attachment_url: formData.attachment_url,
            installation_address: formData.installation_address || null,
            total_value: formData.total_value ? parseFloat(formData.total_value) : null,
            total_m2: formData.total_m2 ? parseFloat(formData.total_m2) : null,
            special_attention: formData.special_attention,
            company_id: profile?.company_id ?? 1,
        };

        if (selectedAppointment) {
            const { error: updateError } = await supabase
                .from('appointments')
                .update(aptPayload)
                .eq('id', selectedAppointment.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('appointments')
                .insert(aptPayload);
            error = insertError;
        }

        if (error) {
            setFormError('Error: ' + error.message);
        } else {
            setIsModalOpen(false);
            resetForm();
            fetchAppointments();
        }
    };

    const handleDelete = async () => {
        if (!selectedAppointment) return;
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', selectedAppointment.id);

        if (error) {
            setFormError('Error al cancelar: ' + error.message);
            setShowDeleteConfirm(false);
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
            attachment_url: '',
            installation_address: '',
            total_value: '',
            total_m2: '',
            special_attention: false,
        });
        setSelectedAppointment(null);
        setFormError('');
        setShowDeleteConfirm(false);
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
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBlockModal(true)}
                        title="Fechar Agenda / Horários Bloqueados"
                        className="flex items-center gap-2 px-4 py-3 bg-white border border-border text-navy font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                    >
                        <Lock size={16} />
                        <span className="hidden sm:inline">Fechar Agenda</span>
                        {blockedPeriods.filter(b => b.is_active).length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                                {blockedPeriods.filter(b => b.is_active).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-5 py-3 bg-accent text-navy font-bold rounded-xl hover:shadow-lg transition-all"
                    >
                        <Plus size={20} />
                        Agendar Visita
                    </button>
                </div>
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
                    const dayBlocks = getApplicableBlocks(day);
                    const dayAppointments = appointments.filter(apt => {
                        const d = apt.date_start ? parseISO(apt.date_start) : (apt.scheduled_at ? parseISO(apt.scheduled_at) : null);
                        return d && isSameDay(d, day);
                    });

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
                                {dayBlocks.map((b, idx) => (
                                    <div key={`block-${idx}`}
                                        className="text-[9px] px-1.5 py-1 rounded bg-red-50 border-l-2 border-red-400 text-red-600 font-bold flex items-center gap-1"
                                        title={b.label}
                                    >
                                        <Lock size={8} className="shrink-0" />
                                        <span className="truncate">{b.time_from.slice(0,5)}–{b.time_to.slice(0,5)}</span>
                                    </div>
                                ))}
                                {dayAppointments.map((apt, idx) => {
                                    const aptTime = format(apt.date_start ? parseISO(apt.date_start) : (apt.scheduled_at ? parseISO(apt.scheduled_at) : new Date()), 'HH:mm')
                                    const isSpecial = apt.special_attention === true
                                    const cardClass = isSpecial
                                        ? 'bg-orange-50 border-orange-500 text-orange-900'
                                        : apt.status === 'pending'
                                            ? 'bg-gray-100 border-gray-400'
                                            : 'bg-bg-dark border-accent'
                                    return (
                                        <div
                                            key={idx}
                                            onClick={(e) => handleAppointmentClick(e, apt)}
                                            className={`text-[10px] p-1.5 rounded flex flex-col border-l-2 transition-transform hover:scale-105 ${cardClass}`}
                                            title={`${aptTime} - ${apt.clients?.name || 'Cliente'}${isSpecial ? ' ⚠ Atención especial' : ''}`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold">{aptTime}</span>
                                                <div className="flex items-center gap-0.5">
                                                    {isSpecial && <AlertTriangle size={10} className="text-orange-500" />}
                                                    {apt.attachment_url && <ShieldCheck size={10} className="text-accent" />}
                                                </div>
                                            </div>
                                            <span className="truncate opacity-70 font-medium">{apt.clients?.name || 'Cliente'}</span>
                                        </div>
                                    )
                                })}
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
                    <div className="glass-card w-full max-w-md bg-white border-none shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-10 pb-6 shrink-0">
                            <h2 className="text-2xl font-bold text-navy">{selectedAppointment ? 'Editar Cita' : 'Nueva Cita'}</h2>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-text-muted hover:text-navy transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 px-10 pb-10">

                        {formError && (
                            <div className="mb-5 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{formError}</span>
                                <button onClick={() => setFormError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                        )}

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
                                <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">
                                    <span className="flex items-center gap-1.5"><MapPin size={12} />Dirección de Instalación</span>
                                </label>
                                <input
                                    type="text" value={formData.installation_address}
                                    onChange={e => setFormData({ ...formData, installation_address: e.target.value })}
                                    placeholder="Calle, número, ciudad…"
                                    className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">
                                        <span className="flex items-center gap-1.5"><Euro size={12} />Valor Total (€)</span>
                                    </label>
                                    <input
                                        type="number" min="0" step="0.01" value={formData.total_value}
                                        onChange={e => setFormData({ ...formData, total_value: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-tight">
                                        <span className="flex items-center gap-1.5"><Layers size={12} />Total m²</span>
                                    </label>
                                    <input
                                        type="number" min="0" step="0.01" value={formData.total_m2}
                                        onChange={e => setFormData({ ...formData, total_m2: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full p-3.5 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Atenção especial */}
                            <div>
                                <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${formData.special_attention ? 'bg-orange-50 border-orange-400' : 'bg-bg-dark border-border hover:border-orange-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.special_attention}
                                        onChange={e => setFormData({ ...formData, special_attention: e.target.checked })}
                                        className="w-4 h-4 accent-orange-500 cursor-pointer"
                                    />
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={15} className={formData.special_attention ? 'text-orange-500' : 'text-gray-400'} />
                                        <div>
                                            <p className={`text-sm font-bold ${formData.special_attention ? 'text-orange-700' : 'text-navy'}`}>Requer atenção especial</p>
                                            <p className="text-[10px] text-gray-400">Marca na agenda con color naranja</p>
                                        </div>
                                    </div>
                                </label>
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
                                {selectedAppointment && (
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/citas/${selectedAppointment.id}/report`)}
                                        className="w-full py-3 bg-navy/5 text-navy font-bold rounded-xl hover:bg-navy hover:text-white transition-all text-sm border border-navy/10 flex items-center justify-center gap-2"
                                    >
                                        <ClipboardList size={16} /> Ver Ficha de Instalación
                                    </button>
                                )}

                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="w-full py-4 bg-accent text-navy font-black rounded-xl hover:shadow-xl transition-all disabled:opacity-50 text-base shadow-sm"
                                >
                                    {selectedAppointment ? 'Actualizar Cita' : 'Confirmar Cita'}
                                </button>

                                {selectedAppointment && !showDeleteConfirm && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all text-sm border border-red-100"
                                    >
                                        Cancelar / Eliminar Cita
                                    </button>
                                )}

                                {selectedAppointment && showDeleteConfirm && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                                        <p className="text-sm text-red-700 font-bold text-center">¿Confirmar eliminación?</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowDeleteConfirm(false)}
                                                className="flex-1 py-2 bg-white border border-border text-navy font-bold rounded-lg text-sm"
                                            >
                                                Volver
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDelete}
                                                className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={14} /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Blocked periods modal */}
            {showBlockModal && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-card w-full max-w-lg bg-white border-none shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center p-8 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                    <Lock size={18} className="text-red-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-navy">Fechar Agenda</h2>
                                    <p className="text-xs text-gray-400">Bloqueia marcações em horários definidos</p>
                                </div>
                            </div>
                            <button onClick={() => setShowBlockModal(false)} className="text-text-muted hover:text-navy">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 px-8 pb-8 space-y-6">
                            {/* Add new block form */}
                            <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                                <p className="text-xs font-black text-navy uppercase tracking-wide flex items-center gap-1.5">
                                    <Settings size={12} /> Novo bloqueio
                                </p>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Nome / Motivo</label>
                                    <input
                                        type="text"
                                        value={blockForm.label}
                                        onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))}
                                        placeholder="Ex: Almuerzo, Reunión, Vacaciones…"
                                        className="w-full p-3 bg-white border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-red-300 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">De (hora)</label>
                                        <input
                                            type="time"
                                            value={blockForm.time_from}
                                            onChange={e => setBlockForm(f => ({ ...f, time_from: e.target.value }))}
                                            className="w-full p-3 bg-white border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-red-300 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Até (hora)</label>
                                        <input
                                            type="time"
                                            value={blockForm.time_to}
                                            onChange={e => setBlockForm(f => ({ ...f, time_to: e.target.value }))}
                                            className="w-full p-3 bg-white border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-red-300 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Dias da semana</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {DAY_LABELS.map((d, i) => {
                                            const active = blockForm.days_of_week.length === 0
                                                ? false
                                                : blockForm.days_of_week.includes(i);
                                            const allDays = blockForm.days_of_week.length === 0;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => {
                                                        setBlockForm(f => {
                                                            const cur = f.days_of_week;
                                                            if (cur.includes(i)) return { ...f, days_of_week: cur.filter(x => x !== i) };
                                                            return { ...f, days_of_week: [...cur, i].sort() };
                                                        });
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-border hover:border-navy'}`}
                                                >
                                                    {d}
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => setBlockForm(f => ({ ...f, days_of_week: [] }))}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${blockForm.days_of_week.length === 0 ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-border hover:border-navy'}`}
                                        >
                                            Todos
                                        </button>
                                    </div>
                                </div>
                                <button
                                    disabled={savingBlock || !blockForm.label || !blockForm.time_from || !blockForm.time_to}
                                    onClick={async () => {
                                        if (!blockForm.label || !blockForm.time_from || !blockForm.time_to) return;
                                        setSavingBlock(true);
                                        await supabase.from('agenda_blocked_periods').insert({
                                            label: blockForm.label,
                                            time_from: blockForm.time_from,
                                            time_to: blockForm.time_to,
                                            days_of_week: blockForm.days_of_week.length > 0 ? blockForm.days_of_week : null,
                                            is_active: true,
                                            company_id: profile?.company_id ?? 1,
                                        });
                                        setBlockForm({ label: '', time_from: '13:00', time_to: '15:00', days_of_week: [] });
                                        await fetchBlockedPeriods();
                                        setSavingBlock(false);
                                    }}
                                    className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors disabled:opacity-40 text-sm flex items-center justify-center gap-2"
                                >
                                    <Lock size={14} /> {savingBlock ? 'Guardando…' : 'Bloquear este horário'}
                                </button>
                            </div>

                            {/* Existing blocks */}
                            <div>
                                <p className="text-xs font-black text-navy uppercase tracking-wide mb-3">
                                    Bloqueios activos ({blockedPeriods.filter(b => b.is_active).length})
                                </p>
                                {blockedPeriods.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-4">Nenhum horário bloqueado</p>
                                ) : (
                                    <div className="space-y-2">
                                        {blockedPeriods.map(b => (
                                            <div key={b.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${b.is_active ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-border opacity-50'}`}>
                                                <Lock size={14} className={b.is_active ? 'text-red-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-navy truncate">{b.label}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {b.time_from.slice(0,5)} – {b.time_to.slice(0,5)}
                                                        {' · '}
                                                        {!b.days_of_week || b.days_of_week.length === 0
                                                            ? 'Todos os dias'
                                                            : b.days_of_week.map((d: number) => DAY_LABELS[d]).join(', ')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        await supabase.from('agenda_blocked_periods')
                                                            .update({ is_active: !b.is_active })
                                                            .eq('id', b.id);
                                                        await fetchBlockedPeriods();
                                                    }}
                                                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-border bg-white text-gray-600 hover:bg-gray-100 shrink-0"
                                                >
                                                    {b.is_active ? 'Pausar' : 'Activar'}
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await supabase.from('agenda_blocked_periods').delete().eq('id', b.id);
                                                        await fetchBlockedPeriods();
                                                    }}
                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 shrink-0"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;
