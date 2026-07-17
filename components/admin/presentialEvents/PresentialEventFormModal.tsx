import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Plus, Trash2, Image as ImageIcon, Save, Ticket, Layers } from 'lucide-react';
import { PresentialEvent, PresentialEventLot, PresentialEventLocation } from '../../../types/presentialEvent';
import { presentialEventService } from '../../../services/presentialEventService';
import * as storageService from '../../../services/storageService';
import { toast } from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';

interface PresentialEventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData: PresentialEvent | null;
}

export const PresentialEventFormModal: React.FC<PresentialEventFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<PresentialEvent, 'id' | 'createdAt' | 'updatedAt'>>({
    title: '',
    subtitle: '',
    coverImage: '',
    date: new Date(),
    startTime: '',
    locationType: 'POLO_RI',
    customLocation: '',
    totalTickets: 0,
    useLots: false,
    lots: [],
    status: 'ACTIVE'
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const formatDateForInput = (date: any): string => {
    if (!date) return '';
    try {
      let d: Date;
      if (date instanceof Date) {
        d = date;
      } else if (date && typeof date.toDate === 'function') {
        d = date.toDate();
      } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date);
      } else {
        return '';
      }

      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (initialData) {
      let eventDate: Date = new Date();
      if (initialData.date) {
        if (initialData.date instanceof Date) {
          eventDate = initialData.date;
        } else if ((initialData.date as any).toDate) {
          eventDate = (initialData.date as any).toDate();
        } else {
          eventDate = new Date(initialData.date as any);
        }
      }

      setFormData({
        title: initialData.title,
        subtitle: initialData.subtitle || '',
        coverImage: initialData.coverImage || '',
        date: isNaN(eventDate.getTime()) ? new Date() : eventDate,
        startTime: initialData.startTime,
        locationType: initialData.locationType,
        customLocation: initialData.customLocation || '',
        totalTickets: initialData.totalTickets,
        useLots: initialData.useLots,
        lots: initialData.lots || [],
        status: initialData.status
      });
      setPreviewUrl(initialData.coverImage || '');
    }
  }, [initialData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAddLot = () => {
    const newLot: PresentialEventLot = {
      id: crypto.randomUUID(),
      name: `Lote ${formData.lots!.length + 1}`,
      type: 'QUANTITY',
      value: 0,
      price: 0
    };
    setFormData(prev => ({
      ...prev,
      lots: [...(prev.lots || []), newLot]
    }));
  };

  const handleRemoveLot = (id: string) => {
    setFormData(prev => ({
      ...prev,
      lots: prev.lots?.filter(l => l.id !== id)
    }));
  };

  const handleLotChange = (id: string, field: keyof PresentialEventLot, value: any) => {
    setFormData(prev => ({
      ...prev,
      lots: prev.lots?.map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let coverImageUrl = formData.coverImage;

      if (imageFile) {
        coverImageUrl = await storageService.uploadFile(imageFile, `events/covers/${Date.now()}_${imageFile.name}`);
      }

      const eventToSave = {
        ...formData,
        coverImage: coverImageUrl,
        date: Timestamp.fromDate(new Date(formData.date))
      };

      if (initialData?.id) {
        await presentialEventService.updateEvent(initialData.id, eventToSave);
        toast.success('Evento atualizado com sucesso!');
      } else {
        await presentialEventService.createEvent(eventToSave);
        toast.success('Evento agendado com sucesso!');
      }

      onSave();
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error('Erro ao salvar evento');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-red/10 rounded-lg">
              <Calendar className="text-brand-red" size={20} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {initialData ? 'Editar Evento' : 'Agendar Novo Evento'}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Capa do Evento (1920x1080)</label>
                <div className="relative group aspect-video bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center cursor-pointer hover:border-brand-red/50 transition-all">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-zinc-400">
                      <ImageIcon size={32} />
                      <span className="text-[10px] font-bold uppercase">Clique para fazer upload</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título do Evento</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                    placeholder="Ex: Aulão de Vespera GCM"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subtítulo (Opcional)</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={e => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                    placeholder="Ex: O maior evento preparatório do Acre"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Date, Time, Location */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Data do Evento</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 text-zinc-600" size={16} />
                    <input
                      required
                      type="date"
                      value={formatDateForInput(formData.date)}
                      onChange={e => {
                        const newDate = new Date(e.target.value + 'T12:00:00');
                        setFormData(prev => ({ ...prev, date: isNaN(newDate.getTime()) ? prev.date : newDate }));
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Horário de Início</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3.5 text-zinc-600" size={16} />
                    <input
                      required
                      type="time"
                      value={formData.startTime}
                      onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Local do Evento</label>
                <select
                  required
                  value={formData.locationType}
                  onChange={e => setFormData(prev => ({ ...prev, locationType: e.target.value as PresentialEventLocation }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                >
                  <option value="POLO_RI">Polo INSANUS CONCURSOS (Rio Branco/AC)</option>
                  <option value="POLO_PV">Polo GABARITO CONCURSOS (Porto Velho/RO)</option>
                  <option value="OTHER">OUTRO (Digitar Local)</option>
                </select>
              </div>

              {formData.locationType === 'OTHER' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Especifique o Local</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3.5 text-zinc-600" size={16} />
                    <input
                      required
                      type="text"
                      value={formData.customLocation}
                      onChange={e => setFormData(prev => ({ ...prev, customLocation: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                      placeholder="Ex: Auditório Hotel X, Rua Y, 123"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total de Ingressos (Cadeiras)</label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-3.5 text-zinc-600" size={16} />
                  <input
                    required
                    type="number"
                    value={formData.totalTickets || ''}
                    onChange={e => setFormData(prev => ({ ...prev, totalTickets: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                    placeholder="Ex: 200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Lots Section */}
          <div className="space-y-6 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Layers className="text-purple-500" size={20} />
                </div>
                <div>
                  <h3 className="text-md font-black text-white uppercase tracking-tight">Divisão por Lotes</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase">Configure a virada automática de lotes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Habilitar Lotes?</span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, useLots: !prev.useLots }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.useLots ? 'bg-brand-red' : 'bg-zinc-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.useLots ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {formData.useLots && (
              <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="grid grid-cols-1 gap-4">
                  {formData.lots?.map((lot, index) => (
                    <div key={lot.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative group overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Nome do Lote</label>
                          <input
                            type="text"
                            value={lot.name}
                            onChange={e => handleLotChange(lot.id, 'name', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                          />
                        </div>

                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Tipo de Virada</label>
                          <select
                            value={lot.type}
                            onChange={e => handleLotChange(lot.id, 'type', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                          >
                            <option value="DATE">Data Limite</option>
                            <option value="QUANTITY">Limite de Ingressos</option>
                          </select>
                        </div>

                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                            {lot.type === 'DATE' ? 'Virar em' : 'Total Ingressos'}
                          </label>
                          {lot.type === 'DATE' ? (
                            <input
                              type="date"
                              value={formatDateForInput(lot.value)}
                              onChange={e => {
                                const newDate = new Date(e.target.value + 'T12:00:00');
                                handleLotChange(lot.id, 'value', isNaN(newDate.getTime()) ? lot.value : newDate);
                              }}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                            />
                          ) : (
                            <input
                              type="number"
                              value={lot.value === 0 ? '' : lot.value as number}
                              onChange={e => handleLotChange(lot.id, 'value', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                            />
                          )}
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Preço</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-[9px] text-zinc-500 font-bold">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={lot.price || ''}
                              onChange={e => handleLotChange(lot.id, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-1 flex justify-center pb-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveLot(lot.id)}
                            className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddLot}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 hover:text-purple-500 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
                  >
                    <Plus size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Próximo Lote</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status Selection */}
          <div className="space-y-4 pt-6 border-t border-zinc-800">
             <div className="flex items-center gap-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status do Evento</label>
             </div>
             <div className="flex gap-4">
                {['ACTIVE', 'FINISHED', 'CANCELLED'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: s as any }))}
                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      formData.status === s 
                        ? 'bg-brand-red border-brand-red text-white' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'
                    }`}
                  >
                    {s === 'ACTIVE' ? 'Ativo' : (s === 'FINISHED' ? 'Finalizado' : 'Cancelado')}
                  </button>
                ))}
             </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-10 py-3 bg-brand-red hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Save className="animate-spin" size={18} /> : <Save size={18} />}
            {initialData ? 'Salvar Alterações' : 'Agendar Evento'}
          </button>
        </div>
      </div>
    </div>
  );
};
