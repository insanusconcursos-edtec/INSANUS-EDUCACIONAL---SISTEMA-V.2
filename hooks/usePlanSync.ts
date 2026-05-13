import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { publishPlan } from '../services/syncService';

interface UsePlanSyncReturn {
  hasPendingChanges: boolean;
  lastModified: Date | null;
  lastSynced: Date | null;
  publish: () => Promise<void>;
  loading: boolean;
  publishing: boolean;
}

export const usePlanSync = (planId: string | undefined): UsePlanSyncReturn => {
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastModified, setLastModified] = useState<Date | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!planId) {
        setLoading(false);
        return;
    }

    // Listen to the Plan Document for timestamp changes
    const unsub = onSnapshot(
      doc(db, 'plans', planId), 
      { serverTimestamps: 'estimate' }, // Garante que timestamps pendentes tenham uma estimativa
      (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Helper to get millis from Timestamp or Date
            const getMillis = (val: any) => {
              if (!val) return 0;
              if (val.toMillis) return val.toMillis();
              if (val.seconds) return val.seconds * 1000;
              if (val instanceof Date) return val.getTime();
              try {
                return new Date(val).getTime() || 0;
              } catch {
                return 0;
              }
            };

            const modifiedMillis = getMillis(data.lastModifiedAt);
            const syncedMillis = getMillis(data.lastSyncedAt);

            setLastModified(data.lastModifiedAt?.toDate ? data.lastModifiedAt.toDate() : (data.lastModifiedAt ? new Date(modifiedMillis) : null));
            setLastSynced(data.lastSyncedAt?.toDate ? data.lastSyncedAt.toDate() : (data.lastSyncedAt ? new Date(syncedMillis) : null));

            // Compare dates
            // Se modificado é maior que sincronizado (com margem de 1s), ou se nunca sincronizou mas tem modificação
            const hasPending = 
              (modifiedMillis > syncedMillis + 10) || 
              (modifiedMillis > 0 && syncedMillis === 0);

            console.log(`[usePlanSync] Plan: ${planId} | Modified: ${modifiedMillis} | Synced: ${syncedMillis} | Pending: ${hasPending}`);
            
            setHasPendingChanges(hasPending);
        }
        setLoading(false);
      },
      (error) => {
        console.error("[usePlanSync] Error listening to plan sync status:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [planId]);

  const handlePublish = async () => {
    if (!planId) return;
    setPublishing(true);
    try {
        await publishPlan(planId);
        // State update handled by listener above
    } catch (error) {
        console.error("Publish failed", error);
        alert("Erro ao publicar alterações. Verifique o console.");
    } finally {
        setPublishing(false);
    }
  };

  return {
    hasPendingChanges,
    lastModified,
    lastSynced,
    publish: handlePublish,
    loading,
    publishing
  };
};