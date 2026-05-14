import { getAdminConfig } from './firebaseAdmin.js';
import { sendPushNotification } from './notificationAdminService.js';
import { formatInTimeZone } from 'date-fns-tz';
import cron from 'node-cron';

/**
 * Runs study reminders for all students who have pending revisions scheduled for today.
 */
export const runStudyReminders = async () => {
  const { dbAdmin } = getAdminConfig();
  
  // Get today's date in America/Sao_Paulo (Brazil) format: YYYY-MM-DD
  const today = formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  
  console.log(`[StudyReminder] Iniciando processamento para: ${today}`);

  try {
    // collectionGroup search across all 'course_reviews' subcollections
    // The user mentioned 'revisions' collection in prompt, but we use existing 'course_reviews'
    const snap = await dbAdmin.collectionGroup('course_reviews')
      .where('scheduledDate', '==', today)
      .where('status', 'in', ['pending', 'missed'])
      .get();

    if (snap.empty) {
      console.log('[StudyReminder] Nenhuma revisão pendente para hoje.');
      return;
    }

    console.log(`[StudyReminder] Encontradas ${snap.size} revisões pendentes.`);

    // Iterate through each pending review
    for (const doc of snap.docs) {
      const data = doc.data();
      const userId = data.userId;
      
      if (!userId) {
        console.warn(`[StudyReminder] Revisão ${doc.id} sem userId. Ignorando.`);
        continue;
      }

      const title = "Hora da sua Revisão! 📚";
      const intervalLabel = data.label || `REV. ${data.reviewIndex} - ${data.intervalDays} DIAS`;
      const discipline = data.disciplineName || 'Disciplina';
      const topic = data.topicName || 'Tópico';
      
      const body = `${intervalLabel}\nDisciplina: ${discipline}\nTópico: ${topic}`;

      // sendPushNotification will find the fcmToken in the 'users' collection automatically
      // based on the userId (which is the uid of the student).
      try {
        await sendPushNotification(userId, title, body, '/student/reviews');
        console.log(`[StudyReminder] Notificação enviada para usuário ${userId} sobre o tópico: ${topic}`);
      } catch (pushErr) {
        console.error(`[StudyReminder] Erro ao enviar para ${userId}:`, pushErr);
      }
    }

  } catch (err) {
    console.error('[StudyReminder] Erro ao processar lembretes de estudo:', err);
  }
};

/**
 * Initializes the study reminder cron job.
 * Runs every 3 hours as requested.
 * Pattern: At minute 0 of every 3rd hour
 */
export const initStudyReminderCron = () => {
  console.log('[StudyReminder] Agendando cron job para rodar a cada 3 horas.');
  
  // Every 3 hours: 0 */3 * * *
  cron.schedule('0 */3 * * *', async () => {
    console.log('[Cron] Executando StudyReminders às', new Date().toISOString());
    await runStudyReminders();
  });

  // Também rodamos uma vez na inicialização para testes ou se o servidor reiniciar
  // Mas talvez seja melhor deixar só o cron. 
  // O usuário disse: "Crie uma função que rode a cada 3 horas".
};
