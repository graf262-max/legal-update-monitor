/**
 * 열린국회정보 API 연동
 * https://open.assembly.go.kr
 * 
 * 제공 데이터:
 * - 진행 중인 입법예고
 * - 국회 의안 정보 (법률안)
 */

import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

const BASE_URL = 'https://open.assembly.go.kr/portal/openapi';

/**
 * 국회 법률안 조회 (최근 처리된 의안)
 */
export async function getRecentBills() {
    const apiKey = process.env.ASSEMBLY_API_KEY;

    if (!apiKey) {
        console.warn('[assembly] ASSEMBLY_API_KEY 환경변수가 설정되지 않았습니다.');
        return [];
    }

    try {
        // 의안 정보 API
        const url = `${BASE_URL}/nzmimeepazxkubdpn?Key=${apiKey}&Type=xml&pSize=100`;

        const response = await fetch(url);
        const xmlText = await response.text();
        const result = await parseStringPromise(xmlText, { explicitArray: false });

        if (!result.nzmimeepazxkubdpn || !result.nzmimeepazxkubdpn.row) {
            return [];
        }

        const bills = Array.isArray(result.nzmimeepazxkubdpn.row)
            ? result.nzmimeepazxkubdpn.row
            : [result.nzmimeepazxkubdpn.row];

        const items = [];
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        for (const bill of bills) {
            // 최근 48시간 이내 처리된 것만 필터링
            const procDate = parseKoreanDate(bill.PROC_DT);
            if (procDate && procDate < twoDaysAgo) {
                continue;
            }

            const billName = bill.BILL_NAME || '';
            const { matched, law: matchedLaw } = isTargetLaw(billName);

            if (matched) {
                const item = {
                    source: 'open.assembly.go.kr',
                    type: getBillType(bill.PROC_RESULT_CD),
                    title: billName,
                    law: matchedLaw.name,
                    proposer: bill.PROPOSER,
                    processDate: bill.PROC_DT,
                    processResult: bill.PROC_RESULT,
                    link: bill.LINK_URL || `https://likms.assembly.go.kr/bill/billDetail.do?billId=${bill.BILL_ID}`,
                    content: `제안자: ${bill.PROPOSER || '정부'}, 처리결과: ${bill.PROC_RESULT || '진행중'}`,
                    rawData: bill
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        return items;
    } catch (error) {
        console.error('[assembly] API 호출 오류:', error.message);
        return [];
    }
}

/**
 * 국회 입법예고 조회
 */
export async function getLegislativePreview() {
    const apiKey = process.env.ASSEMBLY_API_KEY;

    if (!apiKey) {
        console.warn('[assembly] ASSEMBLY_API_KEY 환경변수가 설정되지 않았습니다.');
        return [];
    }

    try {
        // 입법예고 API (국회의원 발의)
        const url = `${BASE_URL}/nknalejkafmcapfap?Key=${apiKey}&Type=xml&pSize=50`;

        const response = await fetch(url);
        const xmlText = await response.text();

        // API 응답 확인
        if (xmlText.includes('ERROR') || xmlText.includes('error')) {
            console.warn('[assembly] 입법예고 API 오류 응답');
            return [];
        }

        const result = await parseStringPromise(xmlText, { explicitArray: false });

        if (!result.nknalejkafmcapfap || !result.nknalejkafmcapfap.row) {
            return [];
        }

        const previews = Array.isArray(result.nknalejkafmcapfap.row)
            ? result.nknalejkafmcapfap.row
            : [result.nknalejkafmcapfap.row];

        const items = [];

        for (const preview of previews) {
            const title = preview.BILL_NAME || preview.NOTI_ED_DT || '';
            const { matched, law: matchedLaw } = isTargetLaw(title);

            if (matched) {
                const item = {
                    source: 'open.assembly.go.kr',
                    type: '국회 입법예고',
                    title: title,
                    law: matchedLaw.name,
                    startDate: preview.NOTI_ST_DT,
                    endDate: preview.NOTI_ED_DT,
                    link: preview.LINK_URL || 'https://pal.assembly.go.kr',
                    content: `예고기간: ${preview.NOTI_ST_DT} ~ ${preview.NOTI_ED_DT}`,
                    rawData: preview
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        return items;
    } catch (error) {
        console.error('[assembly] 입법예고 조회 오류:', error.message);
        return [];
    }
}

/**
 * 모든 국회 데이터 수집
 */
export async function collectAll() {
    const [bills, previews] = await Promise.all([
        getRecentBills(),
        getLegislativePreview()
    ]);

    return [...bills, ...previews];
}

// 헬퍼 함수
function parseKoreanDate(dateStr) {
    if (!dateStr) return null;
    // YYYY-MM-DD 형식
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    return null;
}

function getBillType(procResultCd) {
    const types = {
        '가결': '본회의 통과',
        '원안가결': '본회의 통과',
        '수정가결': '본회의 수정가결',
        '위원회 의결': '상임위 통과',
        '공포': '법률 공포'
    };
    return types[procResultCd] || '의안 처리';
}

export default { collectAll, getRecentBills, getLegislativePreview };
