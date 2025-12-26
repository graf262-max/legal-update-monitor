/**
 * 이메일 발송 서비스 (SendGrid)
 */

import sgMail from '@sendgrid/mail';

/**
 * SendGrid 초기화
 */
export function initEmail() {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
        console.warn('[email] SENDGRID_API_KEY가 설정되지 않았습니다.');
        return false;
    }

    sgMail.setApiKey(apiKey);
    return true;
}

/**
 * 브리핑 이메일 발송
 */
export async function sendBriefingEmail(htmlContent, textContent) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.EMAIL_FROM || 'noreply@example.com';
    const recipients = (process.env.EMAIL_RECIPIENTS || '').split(',').filter(e => e.trim());

    if (!apiKey) {
        console.warn('[email] SENDGRID_API_KEY가 설정되지 않았습니다. 이메일 발송 건너뜀.');
        return { success: false, reason: 'API 키 없음' };
    }

    if (recipients.length === 0) {
        console.warn('[email] EMAIL_RECIPIENTS가 설정되지 않았습니다.');
        return { success: false, reason: '수신자 없음' };
    }

    sgMail.setApiKey(apiKey);

    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const msg = {
        to: recipients,
        from: from,
        subject: `📅 [${dateStr}] 법률·정책 업데이트 브리핑`,
        text: textContent,
        html: htmlContent
    };

    try {
        await sgMail.send(msg);
        console.log(`[email] 이메일 발송 성공: ${recipients.length}명에게 발송`);
        return { success: true, recipients: recipients.length };
    } catch (error) {
        console.error('[email] 발송 오류:', error.message);
        return { success: false, reason: error.message };
    }
}

/**
 * 테스트 이메일 발송
 */
export async function sendTestEmail(recipient) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.EMAIL_FROM || 'noreply@example.com';

    if (!apiKey) {
        return { success: false, reason: 'API 키 없음' };
    }

    sgMail.setApiKey(apiKey);

    const msg = {
        to: recipient,
        from: from,
        subject: '🧪 법률 업데이트 모니터링 시스템 - 테스트 이메일',
        text: '이메일 발송 테스트가 성공적으로 완료되었습니다.',
        html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>✅ 테스트 성공</h2>
        <p>법률 업데이트 모니터링 시스템의 이메일 발송 기능이 정상 작동합니다.</p>
        <p style="color: #666;">발송 시각: ${new Date().toISOString()}</p>
      </div>
    `
    };

    try {
        await sgMail.send(msg);
        return { success: true };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

export default { initEmail, sendBriefingEmail, sendTestEmail };
