/**
 * 법률 업데이트 브리핑 API
 * Netlify Function (Standalone - 모든 코드 포함)
 */

// SSL 인증서 검증 비활성화 (한국 정부 사이트용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ============================================
// CONFIG: 관리 대상 법률
// ============================================
const TARGET_LAWS = [
    { name: '상법', keywords: ['상법'], category: '상거래' },
    { name: '민법', keywords: ['민법'], category: '일반' },
    { name: '개인정보 보호법', keywords: ['개인정보 보호법', '개인정보보호법'], category: '개인정보' },
    { name: '직업안정법', keywords: ['직업안정법'], category: '노동' },
    { name: '정보통신망 이용촉진 및 정보보호 등에 관한 법률', keywords: ['정보통신망'], category: 'IT' },
    { name: '전자금융거래법', keywords: ['전자금융거래법'], category: '금융' },
    { name: '채용절차의 공정화에 관한 법률', keywords: ['채용절차'], category: '노동' },
    { name: '약관의 규제에 관한 법률', keywords: ['약관의 규제', '약관규제법'], category: '공정거래' },
    { name: '독점규제 및 공정거래에 관한 법률', keywords: ['독점규제', '공정거래'], category: '공정거래' },
    { name: '저작권법', keywords: ['저작권법'], category: '지식재산' }
];

const IMPORTANCE_RULES = {
    keywords: { '공포': 3, '시행일': 3, '본회의 통과': 3, '상임위 통과': 2, '입법예고': 1, '개정': 2, '제정': 3, '폐지': 3, '긴급': 3 },
    negativeKeywords: { '시행규칙': -2, '직제': -5 },
    sources: { 'law.go.kr': 2, 'assembly.go.kr': 2, 'pipc.go.kr': 1, 'moel.go.kr': 1, 'msit.go.kr': 1, 'fsc.go.kr': 1, 'ftc.go.kr': 1 }
};

function isTargetLaw(title) {
    const normalized = title.replace(/\s+/g, '');
    for (const law of TARGET_LAWS) {
        for (const kw of law.keywords) {
            if (normalized.includes(kw.replace(/\s+/g, ''))) return { matched: true, law };
        }
    }
    return { matched: false, law: null };
}

function calculateImportance(item) {
    let score = 1;
    const text = `${item.title || ''} ${item.content || ''}`;
    for (const [kw, w] of Object.entries(IMPORTANCE_RULES.keywords)) if (text.includes(kw)) score += w;
    for (const [kw, w] of Object.entries(IMPORTANCE_RULES.negativeKeywords)) if (text.includes(kw)) score += w;
    for (const [domain, w] of Object.entries(IMPORTANCE_RULES.sources)) if ((item.source || '').includes(domain)) { score += w; break; }
    return Math.min(5, Math.max(1, Math.round(score / 2)));
}

function getStarRating(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

// ============================================
// COLLECTORS
// ============================================

// 고용노동부 RSS
async function collectMoel() {
    try {
        const res = await fetch('https://www.moel.go.kr/rss/lawinfo.do', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!res.ok) return [];

        const xml = await res.text();
        const items = [];
        const regex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<dc:date>(.*?)<\/dc:date>[\s\S]*?<\/item>/g;
        let match;

        while ((match = regex.exec(xml)) !== null) {
            const title = match[1];
            const link = match[2];
            const dateStr = match[3];

            const isLabor = /직업안정|채용절차|근로기준|고용|노동|고용보험|산업안전|최저임금|퇴직연금|노동조합/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isLabor) {
                const item = {
                    source: 'moel.go.kr', type: '입법·행정예고', title,
                    law: law?.name || '노동관계법령', pubDate: dateStr.split(' ')[0], link, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        return items;
    } catch (e) { console.error('[moel]', e.message); return []; }
}

// 공정거래위원회
async function collectFtc() {
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=105&key=193', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];

        // 간단한 정규식으로 게시글 파싱
        const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
        const linkRegex = /nttSn=(\d+)/;
        const titleRegex = />([^<]+)</;

        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            const cell = match[1];
            const titleMatch = titleRegex.exec(cell);
            const linkMatch = linkRegex.exec(cell);

            if (titleMatch && linkMatch) {
                const title = titleMatch[1].trim();
                const nttSn = linkMatch[1];

                if (!title || title.length < 5) continue;

                const isFtc = /공정거래|독점규제|약관|하도급|가맹|표시광고|대규모유통|소비자|방문판매|전자상거래/.test(title);
                const { matched, law } = isTargetLaw(title);

                if (matched || isFtc) {
                    const item = {
                        source: 'ftc.go.kr', type: '입법·행정예고', title,
                        law: law?.name || '공정거래 관련 법령', pubDate: '',
                        link: `https://www.ftc.go.kr/www/selectBbsNttView.do?key=193&bordCd=105&nttSn=${nttSn}`,
                        content: ''
                    };
                    item.importance = calculateImportance(item);
                    items.push(item);
                }
            }
        }
        return items;
    } catch (e) { console.error('[ftc]', e.message); return []; }
}

// 모든 수집기 실행
async function collectAll() {
    console.log('[collectors] 수집 시작...');

    const results = { items: [], errors: [], stats: {} };

    // 고용노동부
    try {
        const moelItems = await collectMoel();
        results.stats['고용노동부'] = moelItems.length;
        results.items.push(...moelItems);
        console.log(`[collectors] 고용노동부: ${moelItems.length}건`);
    } catch (e) {
        results.errors.push({ source: '고용노동부', error: e.message });
        results.stats['고용노동부'] = 0;
    }

    // 공정거래위원회
    try {
        const ftcItems = await collectFtc();
        results.stats['공정거래위원회'] = ftcItems.length;
        results.items.push(...ftcItems);
        console.log(`[collectors] 공정거래위원회: ${ftcItems.length}건`);
    } catch (e) {
        results.errors.push({ source: '공정거래위원회', error: e.message });
        results.stats['공정거래위원회'] = 0;
    }

    // 정렬 및 중복 제거
    results.items.sort((a, b) => b.importance - a.importance);
    const seen = new Set();
    results.items = results.items.filter(item => {
        const key = item.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`[collectors] 총 ${results.items.length}건 수집`);
    return results;
}

// ============================================
// HANDLER
// ============================================
export default async (req) => {
    console.log('[daily-brief] 실행:', new Date().toISOString());

    try {
        const url = new URL(req.url);
        const format = url.searchParams.get('format') || 'json';

        const { items, errors, stats } = await collectAll();

        if (format === 'json') {
            return new Response(JSON.stringify({
                success: true,
                briefingDate: new Date().toISOString(),
                totalItems: items.length,
                items, stats, errors: errors.length > 0 ? errors : undefined
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // HTML 형식
        let html = `<h1>법률 업데이트 (${items.length}건)</h1>`;
        for (const item of items) {
            html += `<p><b>${getStarRating(item.importance)}</b> ${item.title} (${item.source})</p>`;
        }
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error) {
        console.error('[daily-brief] 오류:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
};

export const config = { schedule: '0 0 * * *' };
