// Cloudflare Pages Function - 법률 업데이트 수집 API (디버깅용)
// 경로: /api/daily-brief

// 관리 대상 법률 (14개)
const TARGET_LAWS = [
    { name: '상법', keywords: ['상법'] },
    { name: '전자상거래법', keywords: ['전자상거래'] },
    { name: '민법', keywords: ['민법'] },
    { name: '개인정보 보호법', keywords: ['개인정보 보호법', '개인정보보호법'] },
    { name: '직업안정법', keywords: ['직업안정법'] },
    { name: '채용절차법', keywords: ['채용절차'] },
    { name: '정보통신망법', keywords: ['정보통신망'] },
    { name: '인공지능기본법', keywords: ['인공지능'] },
    { name: '전자금융거래법', keywords: ['전자금융거래법'] },
    { name: '자본시장법', keywords: ['자본시장'] },
    { name: '약관규제법', keywords: ['약관의 규제', '약관규제법'] },
    { name: '공정거래법', keywords: ['독점규제', '공정거래'] },
    { name: '표시광고법', keywords: ['표시광고'] },
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

// 디버그 정보를 저장할 배열
let debugLogs = [];

// 고용노동부 RSS (가장 간단한 것부터 테스트)
async function collectMoel() {
    const url = 'https://www.moel.go.kr/rss/lawinfo.do';
    try {
        const res = await fetch(url);
        debugLogs.push({ source: 'moel', status: res.status, ok: res.ok });

        if (!res.ok) return [];

        const xml = await res.text();
        debugLogs.push({ source: 'moel', textLength: xml.length, sample: xml.substring(0, 200) });

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
                    source: 'moel.go.kr', type: '입법·행정예고', title,
                    law: law?.name || '노동관계법령', pubDate: dateStr, link, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        debugLogs.push({ source: 'moel', itemsFound: items.length });
        return items;
    } catch (e) {
        debugLogs.push({ source: 'moel', error: e.message });
        return [];
    }
}

// 공정거래위원회 (스크래핑)
async function collectFtc() {
    const url = 'https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=105&key=193';
    try {
        const res = await fetch(url);
        debugLogs.push({ source: 'ftc', status: res.status, ok: res.ok });

        if (!res.ok) return [];

        const html = await res.text();
        debugLogs.push({ source: 'ftc', textLength: html.length });

        const items = [];
        const titleRegex = /onclick="[^"]*nttSn=(\d+)[^"]*"[^>]*>\s*([^<]+)/g;
        const matches = [...html.matchAll(titleRegex)];

        debugLogs.push({ source: 'ftc', regexMatches: matches.length });

        const seen = new Set();
        for (const m of matches) {
            const nttSn = m[1];
            const title = m[2].trim();
            if (seen.has(nttSn) || !title || title.length < 5) continue;
            seen.add(nttSn);

            const isFtc = /공정거래|독점규제|약관|하도급|가맹|표시광고|대규모유통|소비자|방문판매|전자상거래/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isFtc) {
                const item = {
                    source: 'ftc.go.kr', type: '입법·행정예고', title,
                    law: law?.name || '공정거래 관련 법령', pubDate: '',
                    link: `https://www.ftc.go.kr/www/selectBbsNttView.do?key=193&bordCd=105&nttSn=${nttSn}`, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        return items;
    } catch (e) {
        debugLogs.push({ source: 'ftc', error: e.message });
        return [];
    }
}

// 국가법령정보센터 API
async function collectLawGoKr(env) {
    const OC = env?.LAW_GO_KR_OC;
    debugLogs.push({ source: 'law.go.kr', hasApiKey: !!OC });
    if (!OC) return [];

    try {
        const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=lsRvsn&type=XML&display=20`;
        const res = await fetch(url);
        debugLogs.push({ source: 'law.go.kr', status: res.status });
        if (!res.ok) return [];

        const xml = await res.text();
        const items = [];
        const lawRegex = /<법령최신개정정보>[\s\S]*?<법령ID>(\d+)<\/법령ID>[\s\S]*?<법령명>(.*?)<\/법령명>[\s\S]*?<공포일자>(\d+)<\/공포일자>[\s\S]*?<\/법령최신개정정보>/g;
        let match;

        while ((match = lawRegex.exec(xml)) !== null) {
            const lawName = match[2].trim();
            const pubDate = match[3];
            const { matched, law } = isTargetLaw(lawName);
            if (matched) {
                const item = {
                    source: 'law.go.kr', type: '공포/시행',
                    title: `${lawName} 개정`, law: law?.name || lawName,
                    pubDate: pubDate ? `${pubDate.substring(0, 4)}-${pubDate.substring(4, 6)}-${pubDate.substring(6, 8)}` : '',
                    link: `https://www.law.go.kr/법령/${encodeURIComponent(lawName)}`, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        return items;
    } catch (e) {
        debugLogs.push({ source: 'law.go.kr', error: e.message });
        return [];
    }
}

// 열린국회정보 API
async function collectAssembly(env) {
    const apiKey = env?.ASSEMBLY_API_KEY;
    debugLogs.push({ source: 'assembly', hasApiKey: !!apiKey });
    if (!apiKey) return [];

    try {
        const url = `https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?Key=${apiKey}&Type=json&pSize=30&AGE=22`;
        const res = await fetch(url);
        debugLogs.push({ source: 'assembly', status: res.status });
        if (!res.ok) return [];

        const data = await res.json();
        const rows = data?.nzmimeepazxkubdpn?.[1]?.row || [];
        const items = [];

        for (const row of rows) {
            const billName = row.BILL_NAME || '';
            const { matched, law } = isTargetLaw(billName);
            if (matched) {
                const item = {
                    source: 'assembly.go.kr', type: '발의법률안', title: billName,
                    law: law?.name || '국회 법률안', pubDate: row.PROPOSE_DT || '',
                    link: `https://likms.assembly.go.kr/bill/billDetail.do?billId=${row.BILL_ID || row.BILL_NO}`,
                    content: row.PROPOSER || ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        return items;
    } catch (e) {
        debugLogs.push({ source: 'assembly', error: e.message });
        return [];
    }
}

// 개인정보보호위원회 - 간소화
async function collectPipc() {
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000');
        debugLogs.push({ source: 'pipc', status: res.status, ok: res.ok });
        if (!res.ok) return [];
        return []; // 일단 빈 배열 반환
    } catch (e) {
        debugLogs.push({ source: 'pipc', error: e.message });
        return [];
    }
}

// 과학기술정보통신부 - 간소화
async function collectMsit() {
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mId=113&mPid=112');
        debugLogs.push({ source: 'msit', status: res.status, ok: res.ok });
        if (!res.ok) return [];
        return [];
    } catch (e) {
        debugLogs.push({ source: 'msit', error: e.message });
        return [];
    }
}

// 금융위원회 - 간소화
async function collectFsc() {
    try {
        const res = await fetch('https://www.fsc.go.kr/po040101');
        debugLogs.push({ source: 'fsc', status: res.status, ok: res.ok });
        if (!res.ok) return [];
        return [];
    } catch (e) {
        debugLogs.push({ source: 'fsc', error: e.message });
        return [];
    }
}

// Cloudflare Pages Functions Handler
export async function onRequest(context) {
    const { env } = context;
    debugLogs = []; // 리셋
    debugLogs.push({ start: new Date().toISOString() });

    try {
        const stats = {};
        const errors = [];

        // 모든 수집기를 병렬로 실행
        const collectors = [
            { name: '국가법령정보센터', fn: () => collectLawGoKr(env) },
            { name: '열린국회정보', fn: () => collectAssembly(env) },
            { name: '고용노동부', fn: collectMoel },
            { name: '공정거래위원회', fn: collectFtc },
            { name: '개인정보보호위원회', fn: collectPipc },
            { name: '과학기술정보통신부', fn: collectMsit },
            { name: '금융위원회', fn: collectFsc }
        ];

        const results = await Promise.allSettled(collectors.map(c => c.fn()));

        const items = [];
        results.forEach((result, i) => {
            const name = collectors[i].name;
            if (result.status === 'fulfilled') {
                stats[name] = result.value.length;
                items.push(...result.value);
            } else {
                errors.push({ source: name, error: result.reason?.message || 'Unknown' });
                stats[name] = 0;
            }
        });

        // 중요도순 정렬 & 중복 제거
        items.sort((a, b) => b.importance - a.importance);
        const seen = new Set();
        const uniqueItems = items.filter(item => {
            const key = item.title.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return new Response(JSON.stringify({
            success: true,
            briefingDate: new Date().toISOString(),
            totalItems: uniqueItems.length,
            items: uniqueItems,
            stats,
            errors: errors.length > 0 ? errors : undefined,
            debug: debugLogs // 디버그 정보 포함
        }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            debug: debugLogs
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

export default { fetch: onRequest };
