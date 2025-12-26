/**
 * 금융위원회 웹 스크래핑
 * https://www.fsc.go.kr
 * 
 * 스크래핑 대상:
 * - 입법예고
 * - 보도자료
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

const BASE_URL = 'https://www.fsc.go.kr';

// 입법예고 페이지
const LEGISLATION_URL = `${BASE_URL}/po040101`;
// 보도자료 페이지
const PRESS_URL = `${BASE_URL}/no010101`;

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
            console.warn(`[fsc] 페이지 로드 실패: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const items = [];
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        // 게시판 목록 파싱
        $('table tbody tr, .board_list li, .list_wrap .item').each((i, el) => {
            const $row = $(el);

            // 제목 추출
            let title = '';
            const $titleLink = $row.find('td.title a, .subject a, a.txt_link');
            if ($titleLink.length) {
                title = $titleLink.text().trim();
            } else {
                title = $row.find('td:nth-child(2), .title').text().trim();
            }

            if (!title) return;

            // 날짜 추출
            let dateStr = '';
            const $date = $row.find('td.date, td:nth-child(4), .date, .reg_date');
            if ($date.length) {
                dateStr = $date.text().trim();
            }

            // 날짜 필터링
            const itemDate = parseDate(dateStr);
            if (itemDate && itemDate < twoDaysAgo) {
                return;
            }

            // 링크 추출
            let link = '';
            if ($titleLink.length) {
                const href = $titleLink.attr('href');
                if (href) {
                    link = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                }
            }

            // 금융 관련 법률 체크
            const isFinanceRelated = /전자금융|금융|은행|보험|증권|자본시장|여신|신용|핀테크/.test(title);
            const { matched, law: matchedLaw } = isTargetLaw(title);

            if (matched || isFinanceRelated) {
                const item = {
                    source: 'fsc.go.kr',
                    type: type,
                    title: title,
                    law: matchedLaw?.name || '금융관계법령',
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
        console.error(`[fsc] 스크래핑 오류 (${type}):`, error.message);
        return [];
    }
}

/**
 * 입법예고 수집
 */
export async function getLegislativeNotices() {
    return scrapeBoard(LEGISLATION_URL, '입법예고');
}

/**
 * 보도자료 수집
 */
export async function getPressReleases() {
    return scrapeBoard(PRESS_URL, '보도자료');
}

/**
 * 모든 금융위원회 데이터 수집
 */
export async function collectAll() {
    const [legislation, press] = await Promise.all([
        getLegislativeNotices(),
        getPressReleases()
    ]);

    return [...legislation, ...press];
}

// 헬퍼 함수
function parseDate(dateStr) {
    if (!dateStr) return null;

    const match = dateStr.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    return null;
}

export default { collectAll, getLegislativeNotices, getPressReleases };
