/**
 * 과학기술정보통신부 웹 스크래핑
 * https://www.msit.go.kr
 * 
 * 스크래핑 대상:
 * - 입법예고
 * - 정책/제도 공지
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

const BASE_URL = 'https://www.msit.go.kr';

// 입법예고 페이지
const LEGISLATION_URL = `${BASE_URL}/bbs/list.do?sCode=user&mId=113&mPid=112`;
// 정책자료 페이지
const POLICY_URL = `${BASE_URL}/bbs/list.do?sCode=user&mId=99&mPid=74`;

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
            console.warn(`[msit] 페이지 로드 실패: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const items = [];
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        // 게시판 목록 파싱
        $('table.bbs_list tbody tr, .board_list tbody tr, .list_area li').each((i, el) => {
            const $row = $(el);

            // 공지사항 또는 헤더 행 스킵
            if ($row.hasClass('notice') || $row.find('th').length > 0) {
                return;
            }

            // 제목 추출
            let title = '';
            const $titleLink = $row.find('td.title a, .subject a, a.title');
            if ($titleLink.length) {
                title = $titleLink.text().trim();
            } else {
                title = $row.find('td:nth-child(2)').text().trim();
            }

            if (!title) return;

            // 날짜 추출
            let dateStr = '';
            const $date = $row.find('td.date, td:nth-child(5), .date');
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

            // 과기정통부 관련 법률 체크
            const isMsitRelated = /정보통신|전자금융|저작권|통신|인터넷|ICT|정보보호|개인정보/.test(title);
            const { matched, law: matchedLaw } = isTargetLaw(title);

            if (matched || isMsitRelated) {
                const item = {
                    source: 'msit.go.kr',
                    type: type,
                    title: title,
                    law: matchedLaw?.name || '정보통신 관련 법령',
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
        console.error(`[msit] 스크래핑 오류 (${type}):`, error.message);
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
 * 정책자료 수집
 */
export async function getPolicyData() {
    return scrapeBoard(POLICY_URL, '정책자료');
}

/**
 * 모든 과기정통부 데이터 수집
 */
export async function collectAll() {
    const [legislation, policy] = await Promise.all([
        getLegislativeNotices(),
        getPolicyData()
    ]);

    return [...legislation, ...policy];
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

export default { collectAll, getLegislativeNotices, getPolicyData };
