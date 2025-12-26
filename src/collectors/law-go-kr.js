/**
 * 국가법령정보센터 Open API 연동
 * https://www.law.go.kr
 * 
 * 제공 데이터:
 * - 현행 법령 목록/본문 조회
 * - 입법예고 조회
 * - 최근 공포 법령 조회
 */

import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

const BASE_URL = 'https://www.law.go.kr/DRF';

/**
 * 최근 공포된 법령 조회
 */
export async function getRecentPromulgations() {
    const OC = process.env.LAW_GO_KR_OC;

    if (!OC) {
        console.warn('[law.go.kr] LAW_GO_KR_OC 환경변수가 설정되지 않았습니다.');
        return [];
    }

    try {
        // 최근 공포 법령 검색 (공포일 기준)
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
        const dateStr = formatDate(twoDaysAgo);

        const url = `${BASE_URL}/lawSearch.do?OC=${OC}&target=law&type=XML&display=100&sort=date&pdate=${dateStr}`;

        const response = await fetch(url);
        const xmlText = await response.text();
        const result = await parseStringPromise(xmlText, { explicitArray: false });

        if (!result.LawSearch || !result.LawSearch.law) {
            return [];
        }

        const laws = Array.isArray(result.LawSearch.law)
            ? result.LawSearch.law
            : [result.LawSearch.law];

        const items = [];

        for (const law of laws) {
            const { matched, law: matchedLaw } = isTargetLaw(law.법령명한글 || '');

            if (matched) {
                const item = {
                    source: 'law.go.kr',
                    type: '법령 공포',
                    title: law.법령명한글,
                    law: matchedLaw.name,
                    promulgationDate: law.공포일자,
                    effectiveDate: law.시행일자,
                    link: `https://www.law.go.kr/법령/${encodeURIComponent(law.법령명한글)}`,
                    content: `공포일자: ${law.공포일자}, 시행일자: ${law.시행일자}`,
                    rawData: law
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        return items;
    } catch (error) {
        console.error('[law.go.kr] API 호출 오류:', error.message);
        return [];
    }
}

/**
 * 입법예고 중인 법령 조회
 */
export async function getLegislativeNotices() {
    const OC = process.env.LAW_GO_KR_OC;

    if (!OC) {
        console.warn('[law.go.kr] LAW_GO_KR_OC 환경변수가 설정되지 않았습니다.');
        return [];
    }

    try {
        // 입법예고 목록 조회
        const url = `${BASE_URL}/lawmakingSearch.do?OC=${OC}&target=lawmaking&type=XML&display=50`;

        const response = await fetch(url);
        const xmlText = await response.text();
        const result = await parseStringPromise(xmlText, { explicitArray: false });

        if (!result.LawmakingSearch || !result.LawmakingSearch.lawmaking) {
            return [];
        }

        const notices = Array.isArray(result.LawmakingSearch.lawmaking)
            ? result.LawmakingSearch.lawmaking
            : [result.LawmakingSearch.lawmaking];

        const items = [];
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        for (const notice of notices) {
            // 최근 48시간 이내 등록된 것만 필터링
            const announcementDate = parseDate(notice.공고일);
            if (announcementDate && announcementDate < twoDaysAgo) {
                continue;
            }

            const { matched, law: matchedLaw } = isTargetLaw(notice.법령명한글 || notice.법령명 || '');

            if (matched) {
                const item = {
                    source: 'law.go.kr',
                    type: '입법예고',
                    title: notice.법령명한글 || notice.법령명,
                    law: matchedLaw.name,
                    announcementDate: notice.공고일,
                    deadline: notice.의견마감일,
                    link: notice.링크 || `https://www.law.go.kr/lsLinkCommonInfo.do?lsiSeq=${notice.법령일련번호}`,
                    content: notice.주요내용 || '',
                    rawData: notice
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        return items;
    } catch (error) {
        console.error('[law.go.kr] 입법예고 조회 오류:', error.message);
        return [];
    }
}

/**
 * 모든 법제처 데이터 수집
 */
export async function collectAll() {
    const [promulgations, notices] = await Promise.all([
        getRecentPromulgations(),
        getLegislativeNotices()
    ]);

    return [...promulgations, ...notices];
}

// 헬퍼 함수
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    // YYYYMMDD 또는 YYYY.MM.DD 또는 YYYY-MM-DD 형식 파싱
    const cleaned = dateStr.replace(/[.\-]/g, '');
    if (cleaned.length !== 8) return null;

    const year = parseInt(cleaned.substring(0, 4));
    const month = parseInt(cleaned.substring(4, 6)) - 1;
    const day = parseInt(cleaned.substring(6, 8));

    return new Date(year, month, day);
}

export default { collectAll, getRecentPromulgations, getLegislativeNotices };
