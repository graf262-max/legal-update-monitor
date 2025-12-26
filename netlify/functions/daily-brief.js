// ES Module 형식 (package.json에 "type": "module" 있음)
import fetch from 'node-fetch';

// SSL 인증서 검증 비활성화
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 관리 대상 법률
const TARGET_LAWS = [
    { name: '상법', keywords: ['상법'] },
    { name: '민법', keywords: ['민법'] },
    { name: '개인정보 보호법', keywords: ['개인정보 보호법', '개인정보보호법'] },
    { name: '직업안정법', keywords: ['직업안정법'] },
    { name: '정보통신망법', keywords: ['정보통신망'] },
    { name: '전자금융거래법', keywords: ['전자금융거래법'] },
    { name: '채용절차법', keywords: ['채용절차'] },
    { name: '약관규제법', keywords: ['약관의 규제', '약관규제법'] },
    { name: '공정거래법', keywords: ['독점규제', '공정거래'] },
    { name: '저작권법', keywords: ['저작권법'] }
];

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

    if (text.includes('공포')) score += 3;
    if (text.includes('시행일')) score += 3;
    if (text.includes('본회의 통과')) score += 3;
    if (text.includes('개정')) score += 2;
    if (text.includes('입법예고')) score += 1;
    if (text.includes('시행규칙')) score -= 2;
    if (text.includes('직제')) score -= 5;

    if ((item.source || '').includes('law.go.kr')) score += 2;
    else if ((item.source || '').includes('assembly.go.kr')) score += 2;
    else score += 1;

    return Math.min(5, Math.max(1, Math.round(score / 2)));
}

// 고용노동부 RSS
async function collectMoel() {
    try {
        const res = await fetch('https://www.moel.go.kr/rss/lawinfo.do', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' }
        });
        if (!res.ok) return [];

        const xml = await res.text();
        const items = [];
        const regex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<dc:date>(.*?)<\/dc:date>[\s\S]*?<\/item>/g;
        let match;

        while ((match = regex.exec(xml)) !== null) {
            const title = match[1].trim();
            const link = match[2].trim();
            const dateStr = match[3].split(' ')[0];

            const isLabor = /직업안정|채용절차|근로기준|고용|노동|고용보험|산업안전|최저임금|퇴직연금|노동조합/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isLabor) {
                const item = {
                    source: 'moel.go.kr',
                    type: '입법·행정예고',
                    title,
                    law: law ? law.name : '노동관계법령',
                    pubDate: dateStr,
                    link,
                    content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        return items;
    } catch (e) {
        console.error('[moel] Error:', e.message);
        return [];
    }
}

// 공정거래위원회
async function collectFtc() {
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=105&key=193', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];

        // nttSn과 제목 추출
        const linkRegex = /nttSn=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const uniqueNttSns = [...new Set(matches.map(m => m[1]))];

        // 제목 추출 (onclick 태그에서)
        const titleRegex = /onclick="[^"]*nttSn=(\d+)[^"]*"[^>]*>\s*([^<]+)/g;
        const titleMatches = [...html.matchAll(titleRegex)];
        const titleMap = {};
        for (const m of titleMatches) {
            titleMap[m[1]] = m[2].trim();
        }

        for (const nttSn of uniqueNttSns.slice(0, 15)) {
            const title = titleMap[nttSn];
            if (!title || title.length < 5) continue;

            const isFtc = /공정거래|독점규제|약관|하도급|가맹|표시광고|대규모유통|소비자|방문판매|전자상거래/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isFtc) {
                const item = {
                    source: 'ftc.go.kr',
                    type: '입법·행정예고',
                    title,
                    law: law ? law.name : '공정거래 관련 법령',
                    pubDate: '',
                    link: `https://www.ftc.go.kr/www/selectBbsNttView.do?key=193&bordCd=105&nttSn=${nttSn}`,
                    content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        return items;
    } catch (e) {
        console.error('[ftc] Error:', e.message);
        return [];
    }
}

// Netlify Function Handler (ES Module 형식)
export const handler = async (event, context) => {
    console.log('[daily-brief] Start:', new Date().toISOString());

    try {
        const items = [];
        const stats = {};
        const errors = [];

        // 고용노동부
        try {
            const moelItems = await collectMoel();
            stats['고용노동부'] = moelItems.length;
            items.push(...moelItems);
            console.log('[moel] Collected:', moelItems.length);
        } catch (e) {
            errors.push({ source: '고용노동부', error: e.message });
            stats['고용노동부'] = 0;
        }

        // 공정거래위원회
        try {
            const ftcItems = await collectFtc();
            stats['공정거래위원회'] = ftcItems.length;
            items.push(...ftcItems);
            console.log('[ftc] Collected:', ftcItems.length);
        } catch (e) {
            errors.push({ source: '공정거래위원회', error: e.message });
            stats['공정거래위원회'] = 0;
        }

        // 정렬
        items.sort((a, b) => b.importance - a.importance);

        // 중복 제거
        const seen = new Set();
        const uniqueItems = items.filter(item => {
            const key = item.title.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log('[daily-brief] Total:', uniqueItems.length);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                briefingDate: new Date().toISOString(),
                totalItems: uniqueItems.length,
                items: uniqueItems,
                stats,
                errors: errors.length > 0 ? errors : undefined
            })
        };
    } catch (error) {
        console.error('[daily-brief] Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
