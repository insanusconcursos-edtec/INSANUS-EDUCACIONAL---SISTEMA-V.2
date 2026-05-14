import React, { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const AdminLayout: React.FC = () => {
  const { currentUser, userRole, userData } = useAuth();
  const location = useLocation();
  
  // Register for push notifications
  usePushNotifications();
  
  const adminNav = useMemo(() => {
    const perms = userData?.permissions || {} as any;
    const isAdmin = userRole === 'ADMIN';
    const isCoprodutor = userRole === 'COPRODUTOR';

    const groups = [
      {
        id: 'pedagogico',
        label: 'PEDAGÓGICO',
        items: [] as { label: string; path: string }[]
      },
      {
        id: 'comercial',
        label: 'COMERCIAL',
        items: [] as { label: string; path: string }[]
      },
      {
        id: 'administrativo',
        label: 'ADMINISTRATIVO',
        items: [] as { label: string; path: string }[]
      }
    ];

    if (isCoprodutor) {
      return [
        {
          id: 'coproduction',
          label: 'COPRODUÇÃO',
          items: [
            { label: 'DASHBOARD', path: '/comercial/coprodutor/dashboard' }
          ]
        }
      ];
    }

    if (userRole === 'SELLER') {
      return [
        {
          id: 'vendedor',
          label: 'Comercial',
          items: [
            { label: 'Meu Desempenho', path: '/admin/afiliado' },
            { label: 'Catálogo de Vendas', path: '/admin/vendas' }
          ]
        }
      ];
    }

    // PEDAGÓGICO Group
    if (isAdmin || perms.planos) {
      groups[0].items.push({ label: 'PLANOS', path: '/admin/planos' });
    }
    if (isAdmin || perms.cursos_online) {
      groups[0].items.push({ label: 'CURSOS ONLINE', path: '/admin/cursos' });
    }
    if (isAdmin || perms.turmas_presenciais) {
      groups[0].items.push({ label: 'TURMAS PRESENCIAIS', path: '/admin/presencial' });
    }
    if (isAdmin || perms.simulados) {
      groups[0].items.push({ label: 'SIMULADOS', path: '/admin/simulados' });
    }
    if (isAdmin || perms.eventos_ao_vivo) {
      groups[0].items.push({ label: 'EVENTOS AO VIVO', path: '/admin/eventos-ao-vivo' });
    }
    if (isAdmin || perms.suporte) {
      groups[0].items.push({ label: 'SUPORTE', path: '/admin/suporte' });
    }
    if (isAdmin || perms.alunos) {
      groups[0].items.push({ label: 'ALUNOS', path: '/admin/alunos' });
    }

    // COMERCIAL Group
    if (isAdmin) {
      groups[1].items.push({ label: 'DASHBOARD EMPRESA', path: '/admin/dashboard' });
    }
    if (isAdmin || perms.produtos) {
      groups[1].items.push({ label: 'PRODUTOS', path: '/admin/products' });
    }
    if (isAdmin || perms.vendas) {
      groups[1].items.push({ label: 'VENDAS', path: '/admin/vendas' });
    }
    if (isAdmin || userRole === 'SELLER' || perms.vendas) {
      groups[1].items.push({ label: 'Meu Desempenho', path: '/admin/afiliado' });
    }
    if (isAdmin || perms.vendas) {
      groups[1].items.push({ label: 'RELATÓRIO DE COPRODUÇÃO', path: '/comercial/coprodutor/dashboard' });
    }

    // ADMINISTRATIVO Group
    if (isAdmin || perms.equipe) {
      groups[2].items.push({ label: 'EQUIPE', path: '/admin/equipe' });
    }
    if (isAdmin) {
      groups[2].items.push({ label: 'FINANCEIRO', path: '/admin/financeiro' });
    }
    if (isAdmin) {
      groups[2].items.push({ label: 'MANUTENÇÃO', path: '/admin/manutencao' });
    }

    // Filter out groups with no items
    return groups.filter(group => group.items.length > 0);
  }, [userRole, userData]);

  return (
    <div className="flex flex-col h-screen bg-brand-black text-white font-sans overflow-hidden">
      <Topbar 
        navGroups={adminNav} 
        roleLabel={userRole === 'ADMIN' ? 'Administrador' : (userRole === 'SELLER' ? 'Vendedor' : (userRole === 'COPRODUTOR' ? 'Coprodutor' : 'Colaborador'))}
        dashboardLabel="Painel de Controle"
        userEmail={currentUser?.email || 'Admin'}
      />

      <main className="flex-1 overflow-y-auto bg-brand-dark scrollbar-hide relative">
        <div className={
          /^\/admin\/eventos-ao-vivo\/sala\/[^/]+$/.test(location.pathname)
            ? "w-full p-0 relative"
            : "max-w-[1600px] mx-auto p-4 md:p-8 relative"
        }>
          <Outlet />
        </div>
      </main>
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;