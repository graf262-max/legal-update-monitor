/**
 * 고용노동부 RSS 피드 연동
 * https://www.moel.go.kr
 * 
 * RSS 제공:
 * - 입법·행정예고: https://www.moel.go.kr/rss/lawinfo.do
 */

import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { isTargetLaw, calculateImportance } from '../config/laws.js';

// 고용노동부 RSS 피드 URL (수정됨)
const RSS_URL = 'https://www.moel.go.kr/rss/lawinfo.do';

/**
 * RSS 피드 파싱
 */
async function parseRSSFeed() {
    try {
        const response = await fetch(RSS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        });

        if (!response.ok) {
            console.warn(`[moel] RSS 피드 응답 오류: ${response.status}`);
            return [];
        }

        const xmlText = await response.text();
        const result = await parseStringPromise(xmlText, { explicitArray: false });

        if (!result.rss || !result.rss.channel || !result.rss.channel.item) {
            console.warn('[moel] RSS 데이터 없음');
            return [];
        }

        const items = Array.isArray(result.rss.channel.item)
            ? result.rss.channel.item
            : [result.rss.channel.item];

        const today = new Date();
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        const filtered = [];

        for (const item of items) {
            // 날짜 추출 (dc:date 형식: 2025-12-26 09:01:58)
            const dateStr = item['dc:date'] || item.pubDate || '';
            const pubDate = parseDateString(dateStr);

            // 48시간 이내 항목만 (날짜가 없으면 포함)
            if (pubDate && pubDate < twoDaysAgo) {
                continue;
            }

            const title = item.title || '';
            const { matched, law: matchedLaw } = isTargetLaw(title);

            // 관리 대상 법률 또는 노동 관련 키워드
            const isLabor = /직업안정|채용절차|근로기준|고용|노동|고용보험|산업안전|최저임금|퇴직연금/.test(title);

            if (matched || isLabor) {
                const parsedItem = {
                    source: 'moel.go.kr',
                    type: '입법·행정예고',
                    title: title.replace(/\[\[CDATA\[|\]\]/g, '').trim(),
                    law: matchedLaw?.name || '노동관계법령',
                    pubDate: formatDate(pubDate),
                    link: item.link || '',
                    content: (item.description || '').replace(/\[\[CDATA\[|\]\]/g, '').trim(),
                    rawData: item
                };
                parsedItem.importance = calculateImportance(parsedItem);
                filtered.push(parsedItem);
            }
        }

        return filtered;
    } catch (error) {
        console.error(`[moel] RSS 파싱 오류:`, error.message);
        return [];
    }
}

/**
 * 모든 고용노동부 데이터 수집
 */
export async function collectAll() {
    return parseRSSFeed();
}

// 헬퍼 함수
function parseDateString(dateStr) {
    if (!dateStr) return null;

    // YYYY-MM-DD HH:mm:ss 형식
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    // RFC 822 형식 시도
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default { collectAll };
