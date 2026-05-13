import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Upload } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../../utils/cropImage';
// Ajuste os caminhos de importação conforme a estrutura do seu projeto
import { updateStudentProfile, changeUserPassword, checkNicknameExists } from '../../../services/profileService'; 
import { uploadProfilePhoto } from '../../../services/storageService'; 
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any; // Ajuste para a interface do seu usuário
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Tenta ler a foto do arquivo ou das possíveis propriedades do banco
  const currentPhoto = !isRemovingPhoto ? (photoFile ? URL.createObjectURL(photoFile) : (user?.photoURL || user?.photo || user?.photoUrl)) : null;

  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Busca os dados completos do usuário direto no banco de dados ao abrir o modal
  useEffect(() => {
    const fetchCompleteUserData = async () => {
      if (isOpen && user?.uid) {
        try {
          // Preenchimento otimista (caso a prop user já tenha algo)
          setWhatsapp(user.whatsapp || '');
          setNickname(user.nickname || '');

          // Busca a fonte da verdade no Firestore
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setWhatsapp(userData.whatsapp || user.whatsapp || '');
            setNickname(userData.nickname || user.nickname || '');
          }

          // Limpeza de segurança
          setPassword('');
          setConfirmPassword('');
          setNicknameStatus('idle');
          setError('');
          setSuccess('');
        } catch (error) {
          console.error("Erro ao buscar dados do usuário no Firestore:", error);
        }
      }
    };

    fetchCompleteUserData();
  }, [isOpen, user]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageToCrop(reader.result?.toString() || null));
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = async () => {
    try {
      if (!imageToCrop || !croppedAreaPixels) return;
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels, 'profile.jpg');
      if (croppedFile) {
        setPhotoFile(croppedFile);
        setImageToCrop(null); // Fecha o editor e volta pro formulário
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckNickname = async () => {
    if (!nickname.trim() || nickname === user?.nickname) return;
    setIsCheckingNickname(true);
    try {
      const exists = await checkNicknameExists(nickname, user.uid);
      setNicknameStatus(exists ? 'taken' : 'available');
    } catch (err) {
      console.error("Erro ao verificar apelido:", err);
    } finally {
      setIsCheckingNickname(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    setError('');
    setSuccess('');
    
    if (nickname && nickname !== user?.nickname && nicknameStatus !== 'available') {
      return setError('Por favor, verifique a disponibilidade do apelido clicando no botão "Verificar".');
    }

    // Validação de Senha
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        return setError('As senhas digitadas não são idênticas.');
      }
      if (password.length < 6) {
        return setError('A nova senha deve ter no mínimo 6 caracteres.');
      }
    }

    setLoading(true);
    try {
      const updatedData: any = { whatsapp, nickname };

      // 1. Upload ou Remoção de Foto
      if (isRemovingPhoto) {
        updatedData.photoURL = "";
        updatedData.photo = "";
        
        // Atualiza o Firebase Authentication
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { photoURL: "" });
        }
      } else if (photoFile) {
        const photoURL = await uploadProfilePhoto(user.uid, photoFile);
        
        // Aplica o Cache-Buster (Carimbo de tempo) para forçar o navegador a atualizar a imagem visualmente
        const finalPhotoURL = photoURL.includes('?') 
          ? `${photoURL}&t=${Date.now()}` 
          : `${photoURL}?t=${Date.now()}`;
        
        updatedData.photoURL = finalPhotoURL;
        updatedData.photo = finalPhotoURL;

        // Atualiza o Firebase Authentication com a nova URL
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { photoURL: finalPhotoURL });
        }
      }

      // 2. Atualizar Senha
      if (password) {
        await changeUserPassword(password);
      }

      // 3. Atualizar Dados no Firestore
      await updateStudentProfile(user.uid, updatedData);

      setSuccess('Perfil atualizado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao atualizar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-center items-start pt-[100px] pb-10 px-4 overflow-y-auto bg-black/80 backdrop-blur-sm sm:items-center sm:pt-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 relative flex flex-col gap-4 shadow-2xl my-auto shrink-0">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">Editar Perfil</h2>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-500 p-3 rounded-lg text-sm">{error}</div>}
        {success && <div className="bg-green-500/20 border border-green-500 text-green-500 p-3 rounded-lg text-sm">{success}</div>}

        {/* EDITOR DE IMAGEM CONDICIONAL */}
        {imageToCrop ? (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden border border-gray-700">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                onZoomChange={setZoom}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-sm">Ajustar Zoom</label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-red-500"
              />
            </div>
            <div className="flex justify-end gap-3 mt-2 border-t border-gray-800 pt-4">
              <button type="button" onClick={() => setImageToCrop(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition">Cancelar</button>
              <button type="button" onClick={handleConfirmCrop} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-500/20">Confirmar Corte</button>
            </div>
          </div>
        ) : (
          <>
            {/* Formulário Padrão com Avatar Aumentado */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-sm">Foto de Perfil</label>
              <div className="flex items-center gap-6">
                <div className="w-28 h-28 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-700 shrink-0 shadow-lg relative group">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 text-4xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                  )}
                  {/* Overlay escuro que aparece ao passar o mouse */}
                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity duration-200">
                    <Upload size={24} className="text-white drop-shadow-md" />
                    <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                  </label>
                </div>
                
                <div className="flex flex-col gap-3 items-start">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 text-white py-2.5 px-5 rounded-lg transition border border-gray-700 font-medium text-sm">
                    <Upload size={18} />
                    <span>{currentPhoto ? 'Alterar Foto' : 'Escolher Foto'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                  </label>
                  
                  {currentPhoto && (
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setImageToCrop(null); setIsRemovingPhoto(true); }}
                      className="text-red-500 hover:text-red-400 text-sm font-medium transition ml-1"
                    >
                      Remover Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* WhatsApp e Apelido */}
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-gray-400 text-sm">WhatsApp</label>
              <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-red-500 transition" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-sm">Apelido (Para o Ranking de Simulados)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setNicknameStatus('idle'); // Reseta o status se o usuário começar a digitar de novo
                  }}
                  placeholder={user?.nickname ? `Atual: ${user.nickname}` : "Seu apelido..."}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-red-500 transition"
                />
                <button
                  type="button"
                  onClick={handleCheckNickname}
                  disabled={isCheckingNickname || !nickname.trim() || nickname === user?.nickname}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white font-medium rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                >
                  {isCheckingNickname ? 'Verificando...' : 'Verificar'}
                </button>
              </div>
              {nicknameStatus === 'available' && <span className="text-green-500 text-xs font-medium ml-1">✓ Apelido disponível!</span>}
              {nicknameStatus === 'taken' && <span className="text-red-500 text-xs font-medium ml-1">✕ Este apelido já está em uso. Escolha outro.</span>}
            </div>

            {/* Redefinição de Senha */}
            <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-gray-800">
              <h3 className="text-white font-medium text-sm">Redefinir Senha</h3>
              
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha (mín. 6 caracteres)" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 pr-10 focus:outline-none focus:border-red-500 transition" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-white transition">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="relative mt-2">
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirme a nova senha" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 pr-10 focus:outline-none focus:border-red-500 transition" />
              </div>
            </div>
          </>
        )}

        <button onClick={handleSave} disabled={loading} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50">
          {loading ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
        </button>

      </div>
    </div>
  );
};
