import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EditalNotebookModal } from './EditalNotebookModal';
import { NoteType } from '../../../services/notebookService';

export const NotebookPopout: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const planId = searchParams.get('planId') || '';
  const editalNodeId = searchParams.get('editalNodeId') || '';
  const type = (searchParams.get('type') as NoteType) || 'notes';
  const topicTitle = searchParams.get('topicTitle') || 'Caderno';
  const initialPdfUrl = searchParams.get('initialPdfUrl') || '';
  
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    // 1. Try LocalStorage
    if (sessionId) {
      try {
        const data = localStorage.getItem(sessionId);
        if (data) {
          setSessionData(JSON.parse(data));
        } else if (window.opener) {
          // 2. Try window.opener postMessage fallback (useful for iframes/storage partitioning)
          window.opener.postMessage({ type: 'REQUEST_SESSION_DATA', sessionId }, '*');
        }
      } catch(e) {
         console.error(e);
      }
    }
    
    // Listen for response from mainWindow
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_SESSION_DATA' && event.data?.sessionId === sessionId) {
         setSessionData(event.data.pData);
      }
    };
    window.addEventListener('message', handleMessage);
    
    document.title = "Caderno: " + topicTitle;

    const handleBeforeUnload = () => {
      // Tries to restore the notebook inside the player of the original window
      if (window.opener) {
        window.opener.dispatchEvent(new CustomEvent('TOGGLE_NOTEBOOK', { detail: { open: true } }));
        window.opener.dispatchEvent(new CustomEvent('POPOUT_CLOSED', { detail: { sessionId } }));
      }
      
      // Cleanup localStorage
      if (sessionId) {
        try { 
          localStorage.removeItem(sessionId); 
        } catch (_err) {
          // Ignore removal errors
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, topicTitle]);

  if (!planId || !editalNodeId) {
    return <div className="p-8 text-white h-screen bg-[#09090b]">Carregando caderno... Se o erro persistir, feche e abra novamente.</div>;
  }

  return (
    <div className="w-full h-screen bg-[#09090b] flex overflow-hidden">
      <EditalNotebookModal
        isOpen={true}
        onClose={() => window.close()}
        planId={planId}
        editalNodeId={editalNodeId}
        type={type}
        topicTitle={topicTitle}
        materials={sessionData?.materials || []}
        editalNode={sessionData?.editalNode}
        metaLookup={sessionData?.metaLookup}
        initialPdfUrl={initialPdfUrl || null}
        isEmbedded={false} 
        isPopoutMode={true}
      />
    </div>
  );
};
