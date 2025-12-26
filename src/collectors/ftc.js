/**
 * 공정거래위원회 웹 스크래핑
 * https://www.ftc.go.kr
 * 
 * 스크래핑 대상:
 * - 입법·행정예고: https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=105&key=193
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

const BASE_URL = 'https://www.ftc.go.kr';

// 입법·행정예고 페이지 (수정됨)
const LEGISLATION_URL = `${BASE_URL}/www/selectBbsNttList.do?bordCd=105&key=193`;

/**
 * 게시판 목록 스크래핑
 */
async function scrapeBoard(url, type) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });

        if (!response.ok) {
            console.warn(`[ftc] 페이지 로드 실패: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const items = [];
        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        // 게시판 목록 파싱 (테이블 기반)
        $('table tbody tr').each((i, el) => {
            const $row = $(el);

            // 헤더 행 스킵
            if ($row.find('th').length > 0) return;

            // 제목 추출
            const $titleCell = $row.find('td').eq(1);
            const $titleLink = $titleCell.find('a');
            let title = $titleLink.text().trim() || $titleCell.text().trim();

            if (!title) return;

            // 날짜 추출 (보통 4번째 또는 5번째 열)
            let dateStr = '';
            $row.find('td').each((idx, td) => {
                const text = $(td).text().trim();
                if (/^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}$/.test(text)) {
                    dateStr = text;
                }
            });

            // 날짜 필터링
            const itemDate = parseDate(dateStr);
            if (itemDate && itemDate < twoDaysAgo) {
                return;
            }

            // 링크 추출
            let link = '';
            const onclick = $titleLink.attr('onclick');
            const href = $titleLink.attr('href');

            // nttSn (게시글 번호) 추출 시도
            let nttSn = '';

            if (href) {
                // href에서 nttSn 파라미터 추출
                const nttSnMatch = href.match(/nttSn=(\d+)/);
                if (nttSnMatch) {
                    nttSn = nttSnMatch[1];
                }
            }

            if (onclick) {
                // fn_egov_inqire_notice('46764', '105') 형태 파싱
                const match = onclick.match(/fn_egov_inqire_notice\(['"]?(\d+)['"]?\s*,\s*['"]?(\d+)['"]?\)/);
                if (match) {
                    nttSn = match[1];
                }
            }

            // 올바른 URL 형식으로 생성
            if (nttSn) {
                link = `${BASE_URL}/www/selectBbsNttView.do?key=193&bordCd=105&nttSn=${nttSn}`;
            } else {
                link = LEGISLATION_URL;  // 기본 목록 페이지로 fallback
            }

            // 공정거래 관련 법률 체크
            const isFtcRelated = /공정거래|독점규제|약관|하도급|가맹|표시광고|대규모유통|소비자|방문판매/.test(title);
            const { matched, law: matchedLaw } = isTargetLaw(title);

            if (matched || isFtcRelated) {
                const item = {
                    source: 'ftc.go.kr',
                    type: type,
                    title: title,
                    law: matchedLaw?.name || '공정거래 관련 법령',
                    pubDate: dateStr,
                    link: link || url,
                    content: '',
                    rawData: { title, date: dateStr, link }
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        });

        return items;
    } catch (error) {
        console.error(`[ftc] 스크래핑 오류 (${type}):`, error.message);
        return [];
    }
}

/**
 * 입법·행정예고 수집
 */
export async function getLegislativeNotices() {
    return scrapeBoard(LEGISLATION_URL, '입법·행정예고');
}

/**
 * 모든 공정거래위원회 데이터 수집
 */
export async function collectAll() {
    return getLegislativeNotices();
}

// 헬퍼 함수
function parseDate(dateStr) {
    if (!dateStr) return null;

    const match = dateStr.match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    return null;
}

export default { collectAll, getLegislativeNotices };
