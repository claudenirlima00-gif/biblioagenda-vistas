import emailjs from '@emailjs/browser';

/**
 * Serviço de E-mail para a Biblioteca Municipal de Sobral usando EmailJS (Plano Gratuito)
 * 
 * Para que o envio ocorra de fato, você deve:
 * 1. Criar uma conta em https://www.emailjs.com/
 * 2. Adicionar o e-mail da biblioteca como "Email Service"
 * 3. Criar um "Email Template"
 * 4. Substituir os IDs abaixo pelos seus IDs reais.
 */

const EMAILJS_SERVICE_ID = "service_83979er";
const EMAILJS_TEMPLATE_ADMIN_ID = "template_jesqp2k"; // Resposta da Biblioteca
const EMAILJS_TEMPLATE_USER_ID = "template_he4tp65"; // Solicitação Recebida
const EMAILJS_PUBLIC_KEY = "8EJ2mcLgNsLIuqClY";

export const sendBookingEmail = async (to: string, status: 'pending' | 'confirmed' | 'rejected', details?: { id?: string, responsibleName?: string, institutionName?: string, reason?: string, date?: string, time?: string, details?: string }) => {
  const libraryEmail = "biblioteca@sobral.ce.gov.br";
  const rescheduleUrl = details?.id ? `${window.location.origin}/?reschedule=${details.id}` : "";
  
  const statusLabel = status === 'confirmed' ? "CONFIRMADA" : status === 'rejected' ? "REJEITADA" : "RECEBIDA (AGUARDANDO CONFIRMAÇÃO)";
  const statusColor = status === 'confirmed' ? "#059669" : status === 'rejected' ? "#1e40af" : "#2563eb";
  const statusBg = status === 'confirmed' ? "#ecfdf5" : status === 'rejected' ? "#eff6ff" : "#eff6ff";
  
  let message = "";
  if (status === 'confirmed') {
    message = `Olá ${details?.responsibleName || ''}! Temos o prazer de informar que sua visita agendada para o dia ${details?.date} às ${details?.time} foi CONFIRMADA. Estamos ansiosos para recebê-los!`;
  } else if (status === 'rejected') {
    message = `Olá ${details?.responsibleName || ''}. Infelizmente não pudemos confirmar sua visita para o dia ${details?.date}. Motivo: ${details?.reason}. ${details?.details || ''}`;
  } else {
    message = `Olá ${details?.responsibleName || ''}. Recebemos sua solicitação de visita para o dia ${details?.date} às ${details?.time}. Nossa equipe analisará o pedido e enviará uma confirmação em breve.`;
  }

  const templateId = status === 'pending' ? EMAILJS_TEMPLATE_USER_ID : EMAILJS_TEMPLATE_ADMIN_ID;

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      templateId,
      {
        to_email: to,
        reschedule_url: rescheduleUrl,
        // Versões em CamelCase (minha sugestão inicial)
        responsibleName: details?.responsibleName || 'Responsável',
        institutionName: details?.institutionName || 'Instituição',
        date: details?.date || '',
        time: details?.time || '',
        // Versões em MAIÚSCULO (como vi no seu print)
        RESPONSIBLENAME: details?.responsibleName || 'Responsável',
        INSTITUTIONNAME: details?.institutionName || 'Instituição',
        // Versões traduzidas (como vi no seu print)
        data: details?.date || '',
        tempo: details?.time || '',
        
        status_label: statusLabel,
        status_color: statusColor,
        status_bg: statusBg,
        message: message,
        reason: details?.reason || '',
        details: details?.details || '',
        library_email: libraryEmail
      },
      EMAILJS_PUBLIC_KEY
    );
    
    console.log(`E-mail (${status}) enviado com sucesso para ${to}`);
    return true;
  } catch (error: any) {
    console.error("ERRO CRÍTICO EMAILJS:", error);
    // Se o erro for do EmailJS, ele costuma vir com um texto explicativo
    const errorMsg = error?.text || error?.message || JSON.stringify(error);
    console.error("Falha ao enviar e-mail:", errorMsg);
    return false;
  }
};
