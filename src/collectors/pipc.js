/**
 * 개인정보보호위원회 웹 스크래핑
 * https://www.pipc.go.kr
 * 
 * 스크래핑 대상:
 * - 입법예고/행정예고
 * - 보도자료
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

const BASE_URL = 'https://www.pipc.go.kr';

// 입법예고 페이지 URL (게시판 형식)
const NOTICE_URL = `${BASE_URL}/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000`;
// 보도자료 페이지
const PRESS_URL = `${BASE_URL}/np/cop/bbs/selectBoardList.do?bbsId=BS013&mCode=C010010000`;

/**
 * 게시판 목록 스크래핑
 */
async function scrapeBoard(url, type) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
            }
        });

        if (!response.ok) {
            console.warn(`[pipc] 페이지 로드 실패: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const items = [];
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        // 게시판 목록 파싱 (테이블 형식)
        $('table.board_list tbody tr, .bbs_list li, .list_wrap .list_item').each((i, el) => {
            const $row = $(el);

            // 제목 추출
            let title = '';
            const $titleLink = $row.find('a.subject, td.subject a, .title a, a[href*="selectBoardArticle"]');
            if ($titleLink.length) {
                title = $titleLink.text().trim();
            } else {
                title = $row.find('td:nth-child(2), .title').text().trim();
            }

            if (!title) return;

            // 날짜 추출
            let dateStr = '';
            const $date = $row.find('td.date, .date, td:nth-child(4), .reg_date');
            if ($date.length) {
                dateStr = $date.text().trim();
            }

            // 날짜 파싱 및 필터링
            const itemDate = parseDate(dateStr);
            if (itemDate && itemDate < twoDaysAgo) {
                return; // 48시간 이전 항목 스킵
            }

            // 링크 추출
            let link = '';
            if ($titleLink.length) {
                const href = $titleLink.attr('href');
                if (href) {
                    link = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                }
            }

            // 개인정보 관련 키워드 체크
            const isPersonalInfo = /개인정보|보호법|정보보호|개인정보보호위원회|PIPC/.test(title);
            const { matched, law: matchedLaw } = isTargetLaw(title);

            if (matched || isPersonalInfo) {
                const item = {
                    source: 'pipc.go.kr',
                    type: type,
                    title: title,
                    law: matchedLaw?.name || '개인정보 보호법',
                    pubDate: dateStr,
                    link: link,
                    content: '',
                    rawData: { title, date: dateStr, link }
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        });

        return items;
    } catch (error) {
        console.error(`[pipc] 스크래핑 오류 (${type}):`, error.message);
        return [];
    }
}

/**
 * 입법예고/행정예고 수집
 */
export async function getLegislativeNotices() {
    return scrapeBoard(NOTICE_URL, '입법예고');
}

/**
 * 보도자료 수집
 */
export async function getPressReleases() {
    return scrapeBoard(PRESS_URL, '보도자료');
}

/**
 * 모든 개인정보보호위원회 데이터 수집
 */
export async function collectAll() {
    const [notices, press] = await Promise.all([
        getLegislativeNotices(),
        getPressReleases()
    ]);

    return [...notices, ...press];
}

// 헬퍼 함수
function parseDate(dateStr) {
    if (!dateStr) return null;

    // YYYY.MM.DD 또는 YYYY-MM-DD 형식
    const match = dateStr.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    return null;
}

export default { collectAll, getLegislativeNotices, getPressReleases };
