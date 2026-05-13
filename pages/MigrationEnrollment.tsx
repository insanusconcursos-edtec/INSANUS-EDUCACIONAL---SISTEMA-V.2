import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Mail, 
  Lock, 
  User, 
  CreditCard, 
  Phone,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import toast from 'react-hot-toast';

export default function MigrationEnrollment() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [linkData, setLinkData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    confirmEmail: '',
    cpf: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const validateLink = async () => {
      if (!token) return;
      try {
        const docRef = doc(db, 'MigrationLinks', token);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Verificar se está ativo
          if (!data.active) {
            setError('Este link de migração foi desativado.');
            return;
          }

          // Verificar expiração
          if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
            setError('Este link de migração expirou.');
            return;
          }

          setLinkData({ id: docSnap.id, ...data });
        } else {
          setError('Link de migração inválido.');
        }
      } catch (err) {
        console.error('Erro ao validar link:', err);
        setError('Erro ao validar link de migração.');
      } finally {
        setLoading(false);
      }
    };
    validateLink();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.email !== formData.confirmEmail) {
      return toast.error('Os e-mails não coincidem.');
    }
    if (formData.password !== formData.confirmPassword) {
      return toast.error('As senhas não coincidem.');
    }
    if (formData.password.length < 6) {
      return toast.error('A senha deve ter pelo menos 6 caracteres.');
    }

    setIsSubmitting(true);
    try {
      // 1. Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Criar documento do usuário no Firestore
      const startDate = new Date();
      const endDate = new Date();
      const duration = linkData.accessDurationDays || 365;
      endDate.setDate(startDate.getDate() + duration);
      
      const enrollmentId = `mig_${crypto.randomUUID()}`;

      const userDoc = {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf,
        phone: formData.phone,
        role: 'student',
        createdAt: serverTimestamp(),
        access: [
          {
            id: enrollmentId,
            type: 'course',
            targetId: linkData.courseId,
            isActive: true,
            enrollmentType: 'MIGRACAO',
            diaInicio: Timestamp.fromDate(startDate),
            diaFim: Timestamp.fromDate(endDate)
          }
        ]
      };

      await setDoc(doc(db, 'users', user.uid), userDoc);
      
      // 3. Criar registro na coleção course_enrollments (para o Admin)
      const directEnrollmentId = `${linkData.courseId}_${user.uid}`;
      await setDoc(doc(db, 'course_enrollments', directEnrollmentId), {
        id: directEnrollmentId,
        courseId: linkData.courseId,
        userId: user.uid,
        userName: formData.name,
        userEmail: formData.email,
        userCpf: formData.cpf,
        userPhone: formData.phone,
        enrollmentType: 'MIGRACAO',
        releasedAt: startDate.toISOString(),
        expiresAt: endDate.toISOString(),
        active: true,
        createdAt: serverTimestamp()
      });
      
      // Deslogar para garantir que a nova aba peça login
      await signOut(auth);
      
      setSuccess(true);
      toast.success('Conta criada e acesso liberado!');
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está em uso. Tente fazer login.');
        setActiveTab('login');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 1. Login no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Atualizar documento do usuário com o novo curso
      const startDate = new Date();
      const endDate = new Date();
      const duration = linkData.accessDurationDays || 365;
      endDate.setDate(startDate.getDate() + duration);
      
      const enrollmentId = `mig_${crypto.randomUUID()}`;

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        access: arrayUnion({
          id: enrollmentId,
          type: 'course',
          targetId: linkData.courseId,
          isActive: true,
          enrollmentType: 'MIGRACAO',
          diaInicio: Timestamp.fromDate(startDate),
          diaFim: Timestamp.fromDate(endDate)
        })
      });

      // 3. Criar/Atualizar registro na coleção course_enrollments (para o Admin)
      // Buscamos o perfil do usuário para ter os dados completos
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      const directEnrollmentId = `${linkData.courseId}_${user.uid}`;
      await setDoc(doc(db, 'course_enrollments', directEnrollmentId), {
        id: directEnrollmentId,
        courseId: linkData.courseId,
        userId: user.uid,
        userName: userData?.name || formData.email,
        userEmail: userData?.email || formData.email,
        userCpf: userData?.cpf || '',
        userPhone: userData?.phone || userData?.whatsapp || '',
        enrollmentType: 'MIGRACAO',
        releasedAt: startDate.toISOString(),
        expiresAt: endDate.toISOString(),
        active: true,
        createdAt: serverTimestamp()
      });

      // Deslogar para garantir que a nova aba peça login
      await signOut(auth);

      setSuccess(true);
      toast.success('Acesso liberado com sucesso!');
    } catch (err: any) {
      console.error('Erro no login:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        toast.error('E-mail ou senha incorretos.');
      } else {
        toast.error('Erro ao realizar login. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Validando link de migração...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Link Inválido</h2>
            <p className="text-zinc-500 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Tudo Pronto!</h2>
            <p className="text-emerald-400 font-bold text-sm">Acesso liberado com sucesso.</p>
            <p className="text-zinc-400 text-sm">O curso <strong>{linkData.courseName}</strong> já está disponível no seu painel.</p>
          </div>
          <div className="pt-4">
            <a 
              href="/#/login" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
            >
              Acessar Plataforma
              <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 py-12">
      <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-8 bg-zinc-950/50 border-b border-zinc-800 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
            Migração de Aluno
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
            {linkData.courseName}
          </h1>
          <p className="text-zinc-500 text-sm">Complete seus dados para liberar seu acesso imediato.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'register' 
                ? 'text-red-500 border-b-2 border-red-500 bg-red-500/5' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus size={16} />
              Criar Conta
            </div>
          </button>
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'login' 
                ? 'text-red-500 border-b-2 border-red-500 bg-red-500/5' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <LogIn size={16} />
              Já tenho conta
            </div>
          </button>
        </div>

        <form onSubmit={activeTab === 'register' ? handleRegister : handleLogin} className="p-8 space-y-6">
          {activeTab === 'register' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-left-4 duration-300">
              <div className="md:col-span-2 relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text"
                  required
                  placeholder="Nome Completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-all"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="email"
                  required
                  placeholder="E-mail"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-all"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="email"
                  required
                  placeholder="Confirme o E-mail"
                  value={formData.confirmEmail}
                  onChange={(e) => setFormData({ ...formData, confirmEmail: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-all"
                />
                {formData.confirmEmail && formData.email !== formData.confirmEmail && (
                  <p className="mt-1 text-red-500 text-[10px] font-bold uppercase tracking-widest">Os e-mails não coincidem.</p>
                )}
              </div>

              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text"
                  required
                  placeholder="CPF"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-all"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text"
                  required
                  placeholder="WhatsApp"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Senha"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-red-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <div className="mt-1">
                  {formData.password && formData.password.length < 6 ? (
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">A senha deve conter no mínimo 6 dígitos.</p>
                  ) : (
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Mínimo de 6 caracteres.</p>
                  )}
                </div>
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Confirme a Senha"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-red-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="email"
                  required
                  placeholder="Seu E-mail"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Sua Senha"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-red-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : activeTab === 'register' ? (
              <>
                <UserPlus size={20} />
                Concluir Cadastro e Liberar Acesso
              </>
            ) : (
              <>
                <LogIn size={20} />
                Entrar e Liberar Acesso
              </>
            )}
          </button>

          <p className="text-center text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
            Ao clicar em concluir, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </form>
      </div>
    </div>
  );
}

