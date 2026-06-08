
import React, { useState } from 'react';
import { Link as LinkIcon, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { MaterialLink } from '../../../../services/metaService';

interface MetaLinksEditorProps {
  links: MaterialLink[];
  onChange: (newLinks: MaterialLink[]) => void;
  customColor?: string; // Hex color
}

const MetaLinksEditor: React.FC<MetaLinksEditorProps> = ({ 
  links, 
  onChange,
  customColor = '#3b82f6'
}) => {
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editLinkName, setEditLinkName] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');

  const handleAddLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) return;
    onChange([...links, { name: newLinkName, url: newLinkUrl }]);
    setNewLinkName('');
    setNewLinkUrl('');
  };

  const handleRemoveLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const startEditing = (index: number, link: MaterialLink) => {
    setEditingIndex(index);
    setEditLinkName(link.name);
    setEditLinkUrl(link.url);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
  };

  const handleUpdateLink = () => {
    if (!editLinkName.trim() || !editLinkUrl.trim() || editingIndex === null) return;
    
    const updatedLinks = [...links];
    updatedLinks[editingIndex] = {
      name: editLinkName,
      url: editLinkUrl
    };
    
    onChange(updatedLinks);
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <LinkIcon size={14} style={{ color: customColor }} /> Links Externos
      </label>

      {/* New Link Form */}
      <div className="flex gap-2">
          <input 
              value={newLinkName}
              onChange={(e) => setNewLinkName(e.target.value)}
              placeholder="NOME (EX: QCONCURSOS)"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none uppercase font-bold transition-colors"
              style={{ caretColor: customColor }}
              onFocus={(e) => e.target.style.borderColor = customColor}
              onBlur={(e) => e.target.style.borderColor = '#27272a'}
          />
          <input 
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="HTTPS://..."
              className="flex-[2] bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none transition-colors"
              style={{ caretColor: customColor }}
              onFocus={(e) => e.target.style.borderColor = customColor}
              onBlur={(e) => e.target.style.borderColor = '#27272a'}
          />
          <button 
              type="button"
              onClick={handleAddLink}
              disabled={!newLinkName || !newLinkUrl}
              className="px-4 bg-zinc-800 hover:text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
              style={{ color: customColor }}
          >
              <Plus size={18} />
          </button>
      </div>

      {/* Links List */}
      <div className="space-y-2">
          {links.map((link, index) => (
              <div key={index} className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                  {editingIndex === index ? (
                    <div className="flex gap-2 items-center">
                        <div className="flex-1 space-y-2">
                            <input 
                                value={editLinkName}
                                onChange={(e) => setEditLinkName(e.target.value)}
                                placeholder="NOME DO LINK"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white uppercase font-bold focus:outline-none"
                                style={{ borderColor: customColor }}
                                autoFocus
                            />
                            <input 
                                value={editLinkUrl}
                                onChange={(e) => setEditLinkUrl(e.target.value)}
                                placeholder="URL"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none"
                                style={{ borderColor: customColor }}
                            />
                        </div>
                        <div className="flex gap-1">
                            <button 
                                type="button" 
                                onClick={handleUpdateLink}
                                className="p-1.5 hover:bg-green-900/20 text-green-500 rounded transition-colors"
                            >
                                <Check size={14} />
                            </button>
                            <button 
                                type="button" 
                                onClick={cancelEditing}
                                className="p-1.5 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className="p-1.5 rounded opacity-80 shrink-0"
                              style={{ backgroundColor: `${customColor}20`, color: customColor }}
                            >
                                <LinkIcon size={12} />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-white uppercase truncate">{link.name}</span>
                                <span className="text-[10px] text-zinc-600 truncate">{link.url}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button 
                                type="button" 
                                onClick={() => startEditing(index, link)}
                                className="p-1.5 hover:bg-zinc-800 text-zinc-600 hover:text-white rounded transition-colors"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button 
                                type="button" 
                                onClick={() => handleRemoveLink(index)}
                                className="p-1.5 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                  )}
              </div>
          ))}
      </div>
    </div>
  );
};

export default MetaLinksEditor;
