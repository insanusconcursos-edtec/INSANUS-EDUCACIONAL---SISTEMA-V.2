import React, { useState, useEffect } from 'react';
import { Search, UserX, MessageSquareOff, ShieldCheck } from 'lucide-react';
import { liveChatService } from '../../../../services/liveChatService';
import { LiveActiveUser } from '../../../../types/liveEvent';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import toast from 'react-hot-toast';

interface AdminLiveUserListProps {
  eventId: string;
}

export const AdminLiveUserList: React.FC<AdminLiveUserListProps> = ({ eventId }) => {
  const [users, setUsers] = useState<LiveActiveUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToMod, setUserToMod] = useState<{ user: LiveActiveUser, action: 'block' | 'ban' } | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = liveChatService.subscribeToActiveUsers(eventId, (activeUsers) => {
      setUsers(activeUsers);
    });

    return () => unsubscribe();
  }, [eventId]);

  const filteredUsers = users.filter(user => 
    user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatShortName = (fullName?: string | null) => {
    if (!fullName) return 'Aluno';
    const nameParts = fullName.trim().split(' ');
    return nameParts.slice(0, 2).join(' '); // Pega apenas o 1º e 2º nome
  };

  const handleBlockChat = async (user: LiveActiveUser) => {
    try {
      await liveChatService.blockUserChat(eventId, user.userId, !user.isChatBlocked);
      toast.success(user.isChatBlocked ? "Chat desbloqueado." : "Chat bloqueado.");
    } catch (error) {
      console.error("Error blocking chat:", error);
      toast.error("Erro ao alterar status do chat.");
    }
  };

  const handleBanUser = async (user: LiveActiveUser) => {
    try {
      await liveChatService.banUserFromEvent(eventId, user.userId, !user.isBanned);
      toast.success(user.isBanned ? "Usuário desbanido." : "Usuário banido.");
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Erro ao alterar status de banimento.");
    } finally {
      setUserToMod(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header & Search */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-500" />
            <h2 className="font-bold text-white text-sm uppercase tracking-wider">Usuários Ativos</h2>
          </div>
          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
            {users.length} ONLINE
          </span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-zinc-600">
            <p className="text-sm">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {filteredUsers.map((user) => (
              <div key={user.userId} className="p-3 hover:bg-zinc-900/50 transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {user.userPhoto ? (
                        <img src={user.userPhoto} alt={user.userName} className="w-8 h-8 rounded-full border border-zinc-800" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">
                          {user.userName.charAt(0)}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${user.isBanned ? 'text-red-500 line-through' : 'text-zinc-200'}`}>
                        {formatShortName(user.userName || user.userEmail)}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{user.userEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleBlockChat(user)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        user.isChatBlocked 
                          ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' 
                          : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
                      }`}
                      title={user.isChatBlocked ? "Desbloquear Chat" : "Bloquear Chat"}
                    >
                      <MessageSquareOff size={14} />
                    </button>
                    <button
                      onClick={() => setUserToMod({ user, action: 'ban' })}
                      className={`p-1.5 rounded-lg transition-colors ${
                        user.isBanned 
                          ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                          : 'text-zinc-600 hover:bg-zinc-800 hover:text-red-500'
                      }`}
                      title={user.isBanned ? "Desbanir Usuário" : "Banir Usuário"}
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
                
                {(user.isBanned || user.isChatBlocked) && (
                  <div className="mt-2 flex gap-2">
                    {user.isBanned && (
                      <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-wider">
                        Banido
                      </span>
                    )}
                    {user.isChatBlocked && !user.isBanned && (
                      <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                        Chat Bloqueado
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {userToMod && (
        <ConfirmationModal
          isOpen={true}
          title={userToMod.action === 'ban' ? (userToMod.user.isBanned ? "Desbanir Usuário" : "Banir Usuário") : "Bloquear Chat"}
          message={userToMod.action === 'ban' 
            ? `Tem certeza que deseja ${userToMod.user.isBanned ? 'desbanir' : 'banir'} o usuário ${userToMod.user.userName}?`
            : `Tem certeza que deseja bloquear o chat para ${userToMod.user.userName}?`
          }
          onConfirm={() => userToMod.action === 'ban' ? handleBanUser(userToMod.user) : handleBlockChat(userToMod.user)}
          onCancel={() => setUserToMod(null)}
          confirmText={userToMod.action === 'ban' ? (userToMod.user.isBanned ? "Desbanir" : "Banir") : "Bloquear"}
          isDanger={true}
        />
      )}
    </div>
  );
};
