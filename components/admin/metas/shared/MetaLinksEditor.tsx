
import React, { useState } from 'react';
import { Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
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

  const handleAddLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) return;
    onChange([...links, { name: newLinkName, url: newLinkUrl }]);
    setNewLinkName('');
    setNewLinkUrl('');
  };

  const handleRemoveLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <LinkIcon size={14} style={{ color: customColor }} /> Links Externos
      </label>

      <div className="flex gap-2">
          <input 
              value={newLinkName}
              onChange={(e) => setNewLinkName(e.target.value)}
              placeholder="NOME (EX: QCONCURSOS)"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none uppercase font-bold transition-colors"
              style={{ caretColor: customColor }}
              onFocus={(e) => e.target.style.borderColor = customColor}
              onBlur={(e) => e.target.style.borderColor = '#27272a'} // zinc-800
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
              className="px-4 bg-zinc-800 hover:text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ color: customColor }}
          >
              <Plus size={18} />
          </button>
      </div>

      <div className="space-y-2">
          {links.map((link, index) => (
              <div key={index} className="flex items-center justify-between bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                  <div className="flex items-center gap-3">
                      <div 
                        className="p-1.5 rounded opacity-80"
                        style={{ backgroundColor: `${customColor}20`, color: customColor }}
                      >
                          <LinkIcon size={12} />
                      </div>
                      <div className="flex flex-col">
                          <span className="text-xs font-bold text-white uppercase">{link.name}</span>
                          <span className="text-[10px] text-zinc-600 truncate max-w-[200px]">{link.url}</span>
                      </div>
                  </div>
                  <button 
                      type="button" 
                      onClick={() => handleRemoveLink(index)}
                      className="p-1.5 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-colors"
                  >
                      <Trash2 size={14} />
                  </button>
              </div>
          ))}
      </div>
    </div>
  );
};

export default MetaLinksEditor;
