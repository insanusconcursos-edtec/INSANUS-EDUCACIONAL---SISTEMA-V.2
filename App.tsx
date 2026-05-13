import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import MigrationEnrollment from './pages/MigrationEnrollment';
import PlansPage from './pages/admin/PlansPage';
import PlanEditor from './pages/admin/PlanEditor'; 
import StudentManager from './pages/admin/StudentManager'; 
import SimulatedExamsManager from './pages/admin/SimulatedExamsManager'; 
import SimulatedClassDetails from './pages/admin/SimulatedClassDetails'; 
import TeamManager from './pages/admin/TeamManager';
import Maintenance from './pages/admin/Maintenance';
import { AdminCoursesTab } from './components/admin/courses/AdminCoursesTab'; // Nova Importação
import PresentialClassesPage from './pages/admin/PresentialClasses'; // Nova Importação Presential
import PresentialClassManager from './pages/admin/PresentialClassManager';
import { AdminLiveEvents } from './pages/admin/AdminLiveEvents'; // Nova Importação Eventos ao Vivo
import { AdminLiveEventDetails } from './pages/admin/AdminLiveEventDetails'; // Nova Importação Gerenciar Evento
import { AdminLiveRoom } from './pages/admin/AdminLiveRoom'; // Nova Importação Sala de Transmissão
import AffiliateDashboard from './pages/admin/AffiliateDashboard';
import FinancePage from './pages/admin/FinancePage';
import SalesPage from './pages/admin/SalesPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import CoproductionDashboard from './pages/admin/CoproductionDashboard';
import { StudentCoursesTab } from './components/student/courses/StudentCoursesTab'; // Nova Importação Student
import { StudentPresentialTab } from './components/student/presential/StudentPresentialTab'; // Nova Importação Presential
import { StudentPresentialDetails } from './pages/student/presential/StudentPresentialDetails'; // Nova Importação Detalhes Presencial
import { StudentLiveEvents } from './pages/student/liveEvents/StudentLiveEvents';
import { StudentLiveEventRoom } from './pages/student/liveEvents/StudentLiveEventRoom';
import { VideoRoom } from './components/video/VideoRoom';
import { 
  CollaboratorPermissions 
} from './services/collaboratorService';
import AdminLayout from './components/Layout/AdminLayout';
import StudentLayout from './components/Layout/StudentLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SpacedReviewModalProvider } from './contexts/SpacedReviewModalContext';
import { EdictDataProvider } from './contexts/EdictDataContext';
import PrivateRoute from './components/PrivateRoute';
import StandaloneCheckout from './pages/checkout/StandaloneCheckout';
import SuccessPage from './pages/checkout/SuccessPage';
import { NotebookPopout } from './components/student/tools/NotebookPopout';

// Student Pages Imports
import { 
  StudentDashboard, 
  StudentCalendar, 
  StudentEdict, 
  StudentSimulated
} from './pages/student/StudentPages';
import { StudentHome } from './pages/student/StudentHome';
import StudentConfigPage from './pages/student/StudentConfigPage';
import ProductsManager from './pages/admin/products/ProductsManager';
import { SupportManager } from './pages/admin/SupportManager';

// Wrapper to handle root redirection based on role
const RootRedirect = () => {
    const { userRole, currentUser, loading, userData } = useAuth();
    
    if (loading) return null;
    if (!currentUser) return <Navigate to="/login" replace />;
    
    if (userRole === 'ADMIN' || userRole === 'COLLABORATOR' || userRole === 'SELLER' || userRole === 'COPRODUTOR') {
        const perms = userData?.permissions || {};
        if (userRole === 'COPRODUTOR') return <Navigate to="/comercial/coprodutor/dashboard" replace />;
        // Redireciona Colaboradores e Vendedores para o mesmo dashboard de afiliados/comissões
        if (userRole === 'SELLER' || userRole === 'COLLABORATOR') return <Navigate to="/comercial/dashboard-afiliado" replace />;
        if (userRole === 'ADMIN' || perms.planos) return <Navigate to="/admin/dashboard" replace />;
        if (perms.vendas) return <Navigate to="/admin/vendas" replace />;
        return <Navigate to="/admin/alunos" replace />;
    }
    return <Navigate to="/app/home" replace />;
};

// Helper component to restrict access within Admin area
const AdminRoleGuard = ({ children, permission, strictlyAdmin = false }: { children: React.ReactNode, permission?: keyof CollaboratorPermissions, strictlyAdmin?: boolean }) => {
    const { userRole, userData } = useAuth();
    if (userRole === 'ADMIN') return <>{children}</>;
    
    // Sellers can access common admin areas like Sales and Affiliate Dashboard
    if (userRole === 'SELLER') return <>{children}</>;
    
    if (strictlyAdmin && userRole !== 'ADMIN') {
        return <Navigate to="/comercial/coprodutor/dashboard" replace />;
    }
    
    // Coprodutores só podem ver o que for explicitamente permitido ou rotas comuns
    if (userRole === 'COPRODUTOR' && permission) {
        return <Navigate to="/comercial/coprodutor/dashboard" replace />;
    }
    
    if (userRole === 'COPRODUTOR') return <>{children}</>;
    
    const perms = userData?.permissions || {};
    
    if (permission && !perms[permission]) {
        return <Navigate to="/admin" replace />;
    }

    return <>{children}</>;
};

// Helper to determine the first accessible admin route
const AdminIndexRedirect = () => {
    const { userRole, userData } = useAuth();
    if (userRole === 'COPRODUTOR') return <Navigate to="/comercial/coprodutor/dashboard" replace />;
    if (userRole === 'SELLER' || userRole === 'COLLABORATOR') return <Navigate to="/comercial/dashboard-afiliado" replace />;
    if (userRole === 'ADMIN') return <Navigate to="dashboard" replace />;
    
    const perms = userData?.permissions || {};
    if (perms.vendas) return <Navigate to="afiliado" replace />;
    if (perms.planos) return <Navigate to="planos" replace />;
    if (perms.produtos) return <Navigate to="products" replace />;
    if (perms.cursos_online) return <Navigate to="cursos" replace />;
    if (perms.alunos) return <Navigate to="alunos" replace />;
    
    return <Navigate to="alunos" replace />; // Default fallback
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SpacedReviewModalProvider>
        <EdictDataProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/migracao/:token" element={<MigrationEnrollment />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/checkout/:offerId" element={<StandaloneCheckout />} />
            <Route path="/obrigado" element={<SuccessPage />} />
            <Route path="/notebook-popout" element={<PrivateRoute><NotebookPopout /></PrivateRoute>} />
            
            {/* Video Room (Full Screen) */}
            <Route path="/video-room/:callId" element={
                <PrivateRoute>
                    <VideoRoom />
                </PrivateRoute>
            } />
            
            {/* Admin Routes */}
            <Route path="/admin/eventos-ao-vivo/sala/:id" element={
                <PrivateRoute requiredRole="ADMIN">
                    <AdminLiveRoom />
                </PrivateRoute>
            } />
  
            <Route path="/comercial" element={
                <PrivateRoute requiredRole="ADMIN">
                    <AdminLayout />
                </PrivateRoute>
            }>
                <Route path="coprodutor/dashboard" element={<CoproductionDashboard />} />
                <Route path="dashboard-afiliado" element={<AffiliateDashboard />} />
                <Route path="perfil" element={<StudentHome />} />
            </Route>
  
            <Route path="/admin" element={
                <PrivateRoute requiredRole="ADMIN">
                    <AdminLayout />
                </PrivateRoute>
            }>
                <Route index element={<AdminIndexRedirect />} />
                <Route path="dashboard" element={<AdminRoleGuard strictlyAdmin><AdminDashboard /></AdminRoleGuard>} />
                <Route path="vendas" element={<AdminRoleGuard permission="vendas"><SalesPage /></AdminRoleGuard>} />
                <Route path="afiliado" element={<AffiliateDashboard />} />
                <Route path="planos" element={<AdminRoleGuard permission="planos"><PlansPage /></AdminRoleGuard>} />
                <Route path="plans/:planId" element={<AdminRoleGuard permission="planos"><PlanEditor /></AdminRoleGuard>} />
                
                <Route path="products" element={<AdminRoleGuard permission="produtos"><ProductsManager /></AdminRoleGuard>} />
                <Route path="coproducao" element={<Navigate to="/comercial/coprodutor/dashboard" replace />} />
                <Route path="financeiro" element={<FinancePage />} />
  
                <Route path="cursos" element={<AdminRoleGuard permission="cursos_online"><AdminCoursesTab /></AdminRoleGuard>} /> {/* Nova Rota */}
  
                <Route path="presencial" element={<AdminRoleGuard permission="turmas_presenciais"><PresentialClassesPage /></AdminRoleGuard>} /> {/* Nova Rota Presencial */}
                <Route path="presencial/:classId" element={<AdminRoleGuard permission="turmas_presenciais"><PresentialClassManager /></AdminRoleGuard>} />
  
                <Route path="alunos" element={<AdminRoleGuard permission="alunos"><StudentManager /></AdminRoleGuard>} />
                
                <Route path="simulados" element={<AdminRoleGuard permission="simulados"><SimulatedExamsManager /></AdminRoleGuard>} />
                <Route path="simulados/:classId" element={<AdminRoleGuard permission="simulados"><SimulatedClassDetails /></AdminRoleGuard>} />
                
                <Route path="eventos-ao-vivo" element={<AdminRoleGuard permission="eventos_ao_vivo"><AdminLiveEvents /></AdminRoleGuard>} />
                <Route path="eventos-ao-vivo/:eventId" element={<AdminRoleGuard permission="eventos_ao_vivo"><AdminLiveEventDetails /></AdminRoleGuard>} />
                
                <Route path="equipe" element={<AdminRoleGuard permission="equipe"><TeamManager /></AdminRoleGuard>} />
                
                <Route path="suporte" element={<AdminRoleGuard permission="suporte"><SupportManager /></AdminRoleGuard>} />
                
                <Route path="manutencao" element={<Maintenance />} />
            </Route>
  
            {/* Student Routes */}
            <Route path="/app" element={
                <PrivateRoute requiredRole="STUDENT">
                    <StudentLayout />
                </PrivateRoute>
            }>
                <Route index element={<Navigate to="home" replace />} />
                <Route path="home" element={<StudentHome />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="calendar" element={<StudentCalendar />} />
                <Route path="edict" element={<StudentEdict />} />
                <Route path="simulated" element={<StudentSimulated />} />
                <Route path="courses/:courseId?" element={<StudentCoursesTab />} />
                <Route path="presential" element={<StudentPresentialTab />} />
                <Route path="presential/:classId" element={<StudentPresentialDetails />} />
                <Route path="eventos-ao-vivo" element={<StudentLiveEvents />} />
                <Route path="eventos-ao-vivo/sala/:eventId" element={<StudentLiveEventRoom />} />
                <Route path="config" element={<StudentConfigPage />} />
                
                {/* Fallback for old routes if any */}
                <Route path="metas" element={<Navigate to="dashboard" replace />} />
                <Route path="calendario" element={<Navigate to="calendar" replace />} />
                <Route path="edital" element={<Navigate to="edict" replace />} />
            </Route>
  
            {/* Root Redirect */}
            <Route path="/" element={<RootRedirect />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </EdictDataProvider>
      </SpacedReviewModalProvider>
    </AuthProvider>
  );
};

export default App;