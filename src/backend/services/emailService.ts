import * as nodemailer from 'nodemailer';
import { PresentialEvent } from '../../../types/presentialEvent';
import { generateEventTicketPdf } from './ticketService';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;

    if (!user || !pass) {
      console.warn('⚠️ SMTP_USER ou SMTP_PASS não configurados. O envio de e-mail falhará.');
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: user || 'seu-email@gmail.com',
        pass: pass || 'sua-senha-de-app'
      }
    });
  }
  return transporter;
};

export const sendWelcomeEmail = async (name: string, email: string, password: string, productName: string) => {
  const mailOptions = {
    from: `"Insanus Educacional" <${process.env.SMTP_USER || 'contato@portal-insanus.com'}>`,
    to: email,
    subject: 'Parabéns pela compra! Sua conta foi criada 🚀',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px; color: #18181b;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
          <div style="background: #e11d48; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Bem-vindo à Insanus!</h1>
          </div>
          <div style="padding: 40px;">
            <p style="font-size: 18px; font-weight: bold; margin-top: 0;">Olá, ${name}!</p>
            <p style="line-height: 1.6; color: #52525b;">Parabéns pela sua compra do produto <strong>${productName}</strong>! Sua jornada rumo à aprovação começa agora.</p>
            <p style="line-height: 1.6; color: #52525b;">Informamos que sua conta foi criada automaticamente em nossa plataforma. Seguem seus dados de acesso exclusivos:</p>
            
            <div style="background: #f4f4f5; padding: 24px; border-radius: 16px; margin: 24px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Link de Acesso:</strong> <a href="https://www.portal-insanus.com/login" style="color: #e11d48; text-decoration: none; font-weight: bold;">www.portal-insanus.com/login</a></p>
              <p style="margin: 0 0 8px 0;"><strong>E-mail de Login:</strong> ${email}</p>
              <p style="margin: 0;"><strong>Senha Temporária:</strong> <span style="background: #fde68a; padding: 2px 6px; border-radius: 4px;">${password}</span></p>
            </div>

            <p style="line-height: 1.6; color: #52525b; font-size: 14px; font-style: italic;">* Por segurança, recomendamos a troca da sua senha no primeiro acesso através da sua área do aluno.</p>

            <div style="text-align: center; margin-top: 32px;">
              <a href="https://www.portal-insanus.com/login" style="background: #18181b; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; display: inline-block;">Fazer Primeiro Acesso</a>
            </div>
          </div>
          <div style="background: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #f4f4f5;">
            <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Equipe Insanus Educacional - Foca na farda!</p>
          </div>
        </div>
      </div>
    `
  };
  
  try {
    const client = getTransporter();
    await client.sendMail(mailOptions);
    console.log(`[E-MAIL] Boas-vindas enviadas com sucesso para ${email}`);
  } catch (error) {
    console.error("❌ ERRO CRÍTICO NO SMTP (FALHA AO ENVIAR E-MAIL):", error);
  }
};

export const sendAccessNotificationEmail = async (name: string, email: string, productName: string) => {
  const mailOptions = {
    from: `"Insanus Educacional" <${process.env.SMTP_USER || 'contato@portal-insanus.com'}>`,
    to: email,
    subject: 'Parabéns pela compra! Seu acesso já está liberado 🚀',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px; color: #18181b;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
          <div style="background: #059669; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Acesso Liberado!</h1>
          </div>
          <div style="padding: 40px;">
            <p style="font-size: 18px; font-weight: bold; margin-top: 0;">Olá novamente, ${name}!</p>
            <p style="line-height: 1.6; color: #52525b;">Parabéns pela sua nova compra: <strong>${productName}</strong>!</p>
            <p style="line-height: 1.6; color: #52525b;">O produto <strong>JÁ ESTÁ LIBERADO</strong> na sua conta atual. Você não precisa criar uma nova senha, basta entrar com seus dados de sempre.</p>
            
            <div style="background: #f0fdf4; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid #dcfce7;">
              <p style="margin: 0; text-align: center;"><strong>Link de Acesso Direto:</strong><br><br>
                <a href="https://www.portal-insanus.com/login" style="color: #059669; text-decoration: none; font-weight: bold; font-size: 18px;">www.portal-insanus.com/login</a>
              </p>
            </div>

            <p style="line-height: 1.6; color: #52525b;">Basta logar e o novo conteúdo aparecerá automaticamente na sua área do aluno.</p>

            <div style="text-align: center; margin-top: 32px;">
              <a href="https://www.portal-insanus.com/login" style="background: #18181b; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; display: inline-block;">Acessar Meus Cursos</a>
            </div>
          </div>
          <div style="background: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #f4f4f5;">
            <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Equipe Insanus Educacional - Bons estudos!</p>
          </div>
        </div>
      </div>
    `
  };
  
  try {
    const client = getTransporter();
    await client.sendMail(mailOptions);
    console.log(`[E-MAIL] Notificação de novo acesso enviada para ${email}`);
  } catch (error) {
    console.error("❌ ERRO CRÍTICO NO SMTP (FALHA AO ENVIAR NOTIFICAÇÃO):", error);
  }
};

export const sendPresentialEventTicketEmail = async (
  name: string, 
  email: string, 
  cpf: string,
  productName: string, 
  event: PresentialEvent
) => {
  try {
    const ticketBuffer = await generateEventTicketPdf(event, { name, email, cpf });
    const eventDate = event.date instanceof Date ? event.date : (event.date as any).toDate();
    const dateStr = eventDate.toLocaleDateString('pt-BR');
    
    const location = event.locationType === 'POLO_RI' ? 'Polo INSANUS CONCURSOS (Rio Branco/AC)' : 
                     event.locationType === 'POLO_PV' ? 'Polo GABARITO CONCURSOS (Porto Velho/RO)' : 
                     event.customLocation || 'Não definido';

    const mailOptions = {
      from: `"Insanus Educacional" <${process.env.SMTP_USER || 'contato@portal-insanus.com'}>`,
      to: email,
      subject: `Confirmação de Inscrição: ${event.title} 🎟️`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px; color: #18181b;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
            <div style="background: #e11d48; padding: 40px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Inscrição Confirmada!</h1>
            </div>
            <div style="padding: 40px;">
              <p style="font-size: 18px; font-weight: bold; margin-top: 0;">Parabéns, ${name}!</p>
              <p style="line-height: 1.6; color: #52525b;">Sua vaga para o evento <strong>${event.title}</strong> está garantida. Estamos ansiosos para te ver lá!</p>
              
              <div style="background: #f4f4f5; padding: 24px; border-radius: 16px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; color: #18181b; text-transform: uppercase; font-size: 14px; letter-spacing: 1px;">Informações do Evento:</h3>
                <p style="margin: 0 0 8px 0; color: #52525b;"><strong>Data:</strong> ${dateStr}</p>
                <p style="margin: 0 0 8px 0; color: #52525b;"><strong>Horário de Início:</strong> ${event.startTime}</p>
                <p style="margin: 0; color: #52525b;"><strong>Local:</strong> ${location}</p>
              </div>

              <p style="line-height: 1.6; color: #52525b;">Anexamos a este e-mail o seu <strong>Ticket de Ingresso</strong>. Por favor, apresente-o (impresso ou no celular) na recepção do evento.</p>

              <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 20px; border-radius: 12px; margin-top: 24px;">
                <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                  <strong>Aviso de Reembolso:</strong> O cancelamento da inscrição com direito a reembolso só é permitido até 48 horas antes do evento. O não comparecimento não gera direito a crédito ou estorno.
                </p>
              </div>
            </div>
            <div style="background: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #f4f4f5;">
              <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Equipe Insanus Educacional - Nos vemos no evento!</p>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Ingresso_${event.title.replace(/\s+/g, '_')}.pdf`,
          content: ticketBuffer
        }
      ]
    };

    const client = getTransporter();
    await client.sendMail(mailOptions);
    console.log(`[E-MAIL] Ticket de evento enviado com sucesso para ${email}`);
  } catch (error) {
    console.error("❌ ERRO AO ENVIAR TICKET DE EVENTO:", error);
  }
};
