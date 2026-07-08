import React from 'react';
import { ShieldAlert, Unlock, Star, ShieldCheck } from 'lucide-react';
import { Student, unblockStudent, setExceptionStatus } from '../../../services/userService';
import { toast } from 'react-hot-toast';

interface Props {
    students: Student[];
    onUpdate: () => void;
}

const SecurityContent: React.FC<Props> = ({ students, onUpdate }) => {
    
    const [searchTerm, setSearchTerm] = React.useState('');
    
    const handleUnblock = async (uid: string) => {
        try {
            await unblockStudent(uid);
            toast.success("Conta desbloqueada!");
            onUpdate();
        } catch (error) {
            toast.error("Erro ao desbloquear.");
        }
    };

    const handleToggleException = async (uid: string, isException: boolean | undefined) => {
        try {
            await setExceptionStatus(uid, !isException);
            toast.success(!isException ? "Adicionado à lista de exceções." : "Removido da lista de exceções.");
            onUpdate();
            setSearchTerm('');
        } catch (error) {
            toast.error("Erro ao alterar status.");
        }
    };

    const blockedStudents = students.filter(s => s.blocked);
    const exceptionStudents = students.filter(s => s.isException);
    
    const filteredStudents = searchTerm ? students.filter(s => 
        !s.isException && (
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cpf?.includes(searchTerm)
        )
    ) : [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Blocked Users */}
                <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-black text-white uppercase mb-4 flex items-center gap-2">
                        <ShieldAlert className="text-red-500" /> Contas Bloqueadas
                    </h3>
                    <div className="space-y-3">
                        {blockedStudents.length === 0 && (
                            <p className="text-xs text-zinc-500 font-bold uppercase p-4 text-center">Nenhuma conta bloqueada.</p>
                        )}
                        {blockedStudents.map(s => (
                            <div key={s.uid} className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                <div>
                                    <div className="font-bold text-white uppercase text-xs">{s.name}</div>
                                    <div className="text-[10px] text-zinc-500">{s.blockReason || 'Bloqueio de segurança'}</div>
                                </div>
                                <button onClick={() => handleUnblock(s.uid)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                    <Unlock size={12} /> Desbloquear
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Exceptions */}
                <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-black text-white uppercase mb-4 flex items-center gap-2">
                        <Star className="text-amber-500" /> Exceções (Whitelist)
                    </h3>
                    <div className="space-y-3">
                        {exceptionStudents.length === 0 && (
                            <p className="text-xs text-zinc-500 font-bold uppercase p-4 text-center">Nenhuma conta na whitelist.</p>
                        )}
                        {exceptionStudents.map(s => (
                            <div key={s.uid} className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                <div>
                                    <div className="font-bold text-white uppercase text-xs">{s.name}</div>
                                </div>
                                <button onClick={() => handleToggleException(s.uid, s.isException)} className="text-zinc-500 hover:text-red-500">
                                    <ShieldCheck size={18} />
                                </button>
                            </div>
                        ))}
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                             <p className="text-[10px] text-zinc-500 italic mb-2 uppercase">Pesquisar aluno:</p>
                             <div className="relative">
                                <input 
                                    type="text" 
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white uppercase placeholder-zinc-600"
                                    placeholder="Nome, e-mail ou CPF..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {filteredStudents.length > 0 && (
                                    <div className="absolute z-10 w-full bg-zinc-800 border border-zinc-700 rounded-lg mt-1 max-h-48 overflow-y-auto">
                                        {filteredStudents.map(s => (
                                            <button 
                                                key={s.uid} 
                                                className="w-full text-left p-2 text-xs text-white hover:bg-zinc-700 border-b border-zinc-700"
                                                onClick={() => handleToggleException(s.uid, false)}
                                            >
                                                {s.name} - {s.email}
                                            </button>
                                        ))}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityContent;
