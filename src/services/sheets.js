/**
 * Google Sheets 연동 서비스
 */

import { google } from 'googleapis';

let sheetsClient = null;

/**
 * Google Sheets 클라이언트 초기화
 */
export async function initSheets() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !privateKey) {
        console.warn('[sheets] Google 서비스 계정 정보가 설정되지 않았습니다.');
        return false;
    }

    try {
        const auth = new google.auth.JWT(
            email,
            null,
            privateKey.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        sheetsClient = google.sheets({ version: 'v4', auth });
        console.log('[sheets] Google Sheets 클라이언트 초기화 성공');
        return true;
    } catch (error) {
        console.error('[sheets] 초기화 오류:', error.message);
        return false;
    }
}

/**
 * 법률 업데이트 기록 추가
 */
export async function appendLegalUpdates(items, briefingDate) {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        console.warn('[sheets] GOOGLE_SHEET_ID가 설정되지 않았습니다.');
        return { success: false, reason: 'Sheet ID 없음' };
    }

    if (!sheetsClient) {
        const initialized = await initSheets();
        if (!initialized) {
            return { success: false, reason: '클라이언트 초기화 실패' };
        }
    }

    try {
        // 시트 이름 (년-월)
        const sheetName = `${briefingDate.getFullYear()}-${String(briefingDate.getMonth() + 1).padStart(2, '0')}`;

        // 시트 존재 확인 및 생성
        await ensureSheetExists(sheetId, sheetName);

        // 데이터 변환
        const rows = items.map(item => [
            formatDate(briefingDate),           // 브리핑 날짜
            item.source,                         // 출처
            item.type,                           // 유형
            item.title,                          // 제목
            item.law,                            // 관련 법률
            item.importance,                     // 중요도
            item.pubDate || item.announcementDate || '', // 공고일
            item.link                            // 링크
        ]);

        // 데이터 추가
        const response = await sheetsClient.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${sheetName}!A:H`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });

        console.log(`[sheets] ${rows.length}건 기록 추가 완료`);
        return { success: true, rowsAdded: rows.length };
    } catch (error) {
        console.error('[sheets] 기록 추가 오류:', error.message);
        return { success: false, reason: error.message };
    }
}

/**
 * 시트 존재 확인 및 생성
 */
async function ensureSheetExists(spreadsheetId, sheetName) {
    try {
        // 스프레드시트 정보 조회
        const spreadsheet = await sheetsClient.spreadsheets.get({
            spreadsheetId
        });

        const sheets = spreadsheet.data.sheets || [];
        const exists = sheets.some(s => s.properties.title === sheetName);

        if (!exists) {
            // 새 시트 생성
            await sheetsClient.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: sheetName }
                        }
                    }]
                }
            });

            // 헤더 추가
            await sheetsClient.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1:H1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['브리핑일자', '출처', '유형', '제목', '관련법률', '중요도', '공고일', '링크']]
                }
            });

            console.log(`[sheets] 새 시트 생성: ${sheetName}`);
        }

        return true;
    } catch (error) {
        console.error('[sheets] 시트 확인/생성 오류:', error.message);
        throw error;
    }
}

/**
 * 최근 기록 조회
 */
export async function getRecentRecords(limit = 50) {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId || !sheetsClient) {
        return [];
    }

    try {
        const today = new Date();
        const sheetName = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetName}!A:H`
        });

        const rows = response.data.values || [];
        return rows.slice(-limit);
    } catch (error) {
        console.error('[sheets] 조회 오류:', error.message);
        return [];
    }
}

// 헬퍼 함수
function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default { initSheets, appendLegalUpdates, getRecentRecords };
