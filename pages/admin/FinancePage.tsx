import React, { useState } from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  PieChart, 
  ArrowUpRight 
} from 'lucide-react';
import CoproducersPage from './CoproducersPage';

type FinanceTab = 'coproducers' | 'overview' | 'reports';

const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinanceTab>('coproducers');

  const tabs = [
    { id: 'overview' as const, label: 'Visão Geral', icon: TrendingUp, disabled: true },
    { id: 'coproducers' as const, label: 'Coprodutores', icon: Users, disabled: false },
    { id: 'reports' as const, label: 'Relatórios', icon: PieChart, disabled: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <DollarSign className="w-8 h-8 text-emerald-500" />
            </div>
            Gestão Financeira
          </h1>
          <p className="text-gray-400 mt-1 text-lg">Gerencie splits de pagamento, parceiros e relatórios financeiros.</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-brand-black/50 border border-white/10 p-4 rounded-xl flex items-center gap-4">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Status Marketplace</p>
              <p className="text-sm font-semibold text-white">Mercado Pago Ativo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-t-lg transition-all relative
                ${activeTab === tab.id 
                  ? 'text-emerald-500 bg-white/5 border-b-2 border-emerald-500 font-bold' 
                  : 'text-gray-500 hover:text-gray-300'}
                ${tab.disabled && 'opacity-50 cursor-not-allowed'}
              `}
            >
              <Icon size={18} />
              {tab.label}
              {tab.id === 'coproducers' && (
                <span className="ml-1 bg-emerald-500/20 text-emerald-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  Ativo
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'coproducers' && <CoproducersPage />}
        {activeTab === 'overview' && (
          <div className="bg-brand-black/50 border border-white/10 rounded-2xl p-12 text-center text-gray-500">
            Painel de Visão Geral em desenvolvimento.
          </div>
        )}
        {activeTab === 'reports' && (
          <div className="bg-brand-black/50 border border-white/10 rounded-2xl p-12 text-center text-gray-500">
            Módulo de Relatórios em desenvolvimento.
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancePage;
