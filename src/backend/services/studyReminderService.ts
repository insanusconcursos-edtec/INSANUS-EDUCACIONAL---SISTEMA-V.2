import { getAdminConfig } from './firebaseAdmin.js';
import { sendPushNotification } from './notificationAdminService.js';
import { formatInTimeZone } from 'date-fns-tz';
import cron from 'node-cron';

/**
 * Runs activity reminders every 5 minutes.
 * Checks user routine events and sends push notifications.
 */
export const runActivityReminders = async () => {
  const { dbAdmin } = getAdminConfig();
  const now = new Date();
  const todayDateStr = formatInTimeZone(now, 'America/Sao_Paulo', 'yyyy-MM-dd');
  
  // Corrigindo formatInTimeZone 'i' (ISO day of week 1-7) para o nosso formato 0-6 (0=Dom)
  // date-fns-tz 'i' retorna 1-7 (Seg-Dom). Nosso DAYS usa 0=Dom, 1=Seg...
  const isoDay = parseInt(formatInTimeZone(now, 'America/Sao_Paulo', 'i'));
  const currentDay = isoDay === 7 ? 0 : isoDay;

  const currentHour = parseInt(formatInTimeZone(now, 'America/Sao_Paulo', 'H'));
  const currentMin = parseInt(formatInTimeZone(now, 'America/Sao_Paulo', 'm'));
  const currentTimeInMinutes = currentHour * 60 + currentMin;

  console.log(`[ActivityReminder] Verificando atividades - Dia: ${currentDay}, Hora: ${currentHour}:${currentMin}`);

  try {
    const usersSnap = await dbAdmin.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const activeRoutineId = userData.activeRoutineId;
      const savedRoutines = userData.savedRoutines || [];
      
      if (!activeRoutineId || savedRoutines.length === 0) continue;

      const activeRoutine = savedRoutines.find((r: any) => String(r.id) === String(activeRoutineId));
      if (!activeRoutine || !activeRoutine.events) continue;

      for (const event of activeRoutine.events) {
        if (!event.notificationEnabled || !event.days.includes(currentDay)) continue;

        const [h, m] = event.startTime.split(':').map(Number);
        const eventStartInMinutes = h * 60 + m;
        const reminderMinutes = event.reminderMinutes || 0;
        const targetTimeInMinutes = eventStartInMinutes - reminderMinutes;

        // Se estamos no horário de enviar (ou já passamos mas ainda não começou faz tempo)
        if (currentTimeInMinutes >= targetTimeInMinutes && currentTimeInMinutes < eventStartInMinutes + 2) {
          const lockId = `${event.id}_${todayDateStr}`;
          const lockRef = userDoc.ref.collection('activity_reminders').doc(lockId);
          
          const lockSnap = await lockRef.get();
          if (lockSnap.exists) continue;

          // Enviar Notificação
          const title = event.title;
          const body = reminderMinutes === 0 
            ? "Sua atividade começa agora!" 
            : `Sua atividade começa em ${reminderMinutes} minutos!`;

          try {
            await sendPushNotification(userDoc.id, title, body, '/student/calendar');
            await lockRef.set({ sentAt: now, date: todayDateStr });
            console.log(`[ActivityReminder] Notificação enviada para ${userDoc.id}: ${title}`);
          } catch (pushErr) {
            console.error(`[ActivityReminder] Erro ao enviar para ${userDoc.id}:`, pushErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('[ActivityReminder] Erro geral:', err);
  }
};

/**
 * Runs study reminders for all students.
 * Today's Revisions: Sent every 3 hours (8h, 11h, 14h, 17h, 20h).
 * Delayed Revisions: Sent 2 times a day (10h, 16h).
 */
export const runStudyReminders = async () => {
  const { dbAdmin } = getAdminConfig();
  
  // Get current date and hour in America/Sao_Paulo (Brazil)
  const now = new Date();
  const today = formatInTimeZone(now, 'America/Sao_Paulo', 'yyyy-MM-dd');
  const currentHour = parseInt(formatInTimeZone(now, 'America/Sao_Paulo', 'H'));
  
  console.log(`[StudyReminder] Iniciando processamento - Data: ${today}, Hora: ${currentHour}h`);

  const isTodayRevisionHour = [8, 11, 14, 17, 20].includes(currentHour);
  const isDelayedRevisionHour = [10, 16].includes(currentHour);

  if (!isTodayRevisionHour && !isDelayedRevisionHour) {
    console.log(`[StudyReminder] Hora ${currentHour}h não agendada para notificações. Pulando.`);
    return;
  }

  try {
    // 1. LÓGICA DE REVISÕES DO DIA (Hora da sua Revisão! 📚)
    if (isTodayRevisionHour) {
      console.log(`[StudyReminder] Processando revisões de HOJE para ${currentHour}h.`);
      const todaySnap = await dbAdmin.collectionGroup('course_reviews')
        .where('scheduledDate', '==', today)
        .where('status', 'in', ['pending', 'missed'])
        .get();

      if (!todaySnap.empty) {
        console.log(`[StudyReminder] Encontradas ${todaySnap.size} revisões para hoje.`);
        for (const docSnap of todaySnap.docs) {
          const data = docSnap.data();
          const userId = data.userId;
          
          if (!userId) continue;

          // Double check status in real-time before sending
          const latestDoc = await docSnap.ref.get();
          const latestStatus = latestDoc.data()?.status;
          if (latestStatus !== 'pending' && latestStatus !== 'missed') {
            console.log(`[StudyReminder] Revisão ${docSnap.id} já foi concluída/alterada. Pulando.`);
            continue;
          }

          const title = "Hora da sua Revisão! 📚";
          const intervalLabel = data.label || `REV. ${data.reviewIndex} - ${data.intervalDays} DIAS`;
          const discipline = data.disciplineName || 'Disciplina';
          const topic = data.topicName || 'Tópico';
          const body = `${intervalLabel} - ${discipline}: ${topic}`;

          try {
            await sendPushNotification(userId, title, body, '/student/reviews');
            console.log(`[StudyReminder] Notificação de HOJE enviada para ${userId}: ${topic}`);
          } catch (pushErr) {
            console.error(`[StudyReminder] Erro ao enviar notificação para ${userId}:`, pushErr);
          }
        }
      } else {
        console.log('[StudyReminder] Nenhuma revisão pendente para hoje.');
      }
    }

    // 2. LÓGICA DE REVISÕES ATRASADAS (Atenção aos estudos! ⚠️)
    if (isDelayedRevisionHour) {
      console.log(`[StudyReminder] Processando revisões ATRASADAS para ${currentHour}h.`);
      const delayedSnap = await dbAdmin.collectionGroup('course_reviews')
        .where('scheduledDate', '<', today)
        .where('status', 'in', ['pending', 'missed'])
        .get();

      if (!delayedSnap.empty) {
        // Agrupar por userId para enviar apenas uma notificação geral por usuário
        const usersToNotify = new Set<string>();
        delayedSnap.docs.forEach(docSnap => {
          if (docSnap.data().userId) usersToNotify.add(docSnap.data().userId);
        });

        console.log(`[StudyReminder] Encontrados ${usersToNotify.size} usuários com revisões atrasadas.`);

        for (const userId of usersToNotify) {
          // Verificar se o usuário ainda tem pelo menos uma revisão atrasada e pendente
          const checkSnap = await dbAdmin.collectionGroup('course_reviews')
            .where('userId', '==', userId)
            .where('scheduledDate', '<', today)
            .where('status', 'in', ['pending', 'missed'])
            .limit(1)
            .get();

          if (checkSnap.empty) {
            console.log(`[StudyReminder] Usuário ${userId} já regularizou suas pendências. Pulando.`);
            continue;
          }

          const title = "Atenção aos estudos! ⚠️";
          const body = "Você possui revisões em atraso. Não deixe o conteúdo acumular!";

          try {
            await sendPushNotification(userId, title, body, '/student/reviews');
            console.log(`[StudyReminder] Notificação de ATRASO enviada para ${userId}`);
          } catch (pushErr) {
            console.error(`[StudyReminder] Erro ao enviar notificação de atraso para ${userId}:`, pushErr);
          }
        }
      } else {
        console.log('[StudyReminder] Nenhuma revisão atrasada encontrada.');
      }
    }

  } catch (err) {
    console.error('[StudyReminder] Erro geral ao processar lembretes de estudo:', err);
  }
};

/**
 * Initializes the study reminder cron job.
 * Runs every hour to check for scheduled times.
 */
export const initStudyReminderCron = () => {
  console.log('[StudyReminder] Agendando cron jobs.');
  
  // 1. Revisões de Estudo (Hora em hora para bater com as horas cheias configuradas)
  cron.schedule('0 8-21 * * *', async () => {
    console.log('[Cron] Executando verificação de StudyReminders às', new Date().toISOString());
    await runStudyReminders();
  });

  // 2. Atividades do Planner (A cada 5 minutos)
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Executando verificação de ActivityReminders às', new Date().toISOString());
    await runActivityReminders();
  });
};
