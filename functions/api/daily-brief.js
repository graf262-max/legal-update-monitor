// Cloudflare Pages Function - API 전용 (국가법령정보센터 + 열린국회정보)
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
    return Math.min(5, Math.max(1, Math.round(score / 2)));
}

// 국가법령정보센터 API
async function collectLawGoKr(env) {
    const OC = env?.LAW_GO_KR_OC;
    if (!OC) {
        return { items: [], error: 'API 키 미설정 (LAW_GO_KR_OC)' };
    }

    try {
        // 최근 법령 개정 정보 조회
        const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=lsRvsn&type=XML&display=50`;
        const res = await fetch(url);

        if (!res.ok) {
            return { items: [], error: `HTTP ${res.status}` };
        }

        const xml = await res.text();
        const items = [];

        // 법령 정보 추출
        const lawRegex = /<법령최신개정정보>[\s\S]*?<법령ID>(\d+)<\/법령ID>[\s\S]*?<법령명>(.*?)<\/법령명>[\s\S]*?<공포일자>(\d+)<\/공포일자>[\s\S]*?<\/법령최신개정정보>/g;
        let match;

        while ((match = lawRegex.exec(xml)) !== null) {
            const lawId = match[1];
            const lawName = match[2].trim();
            const pubDate = match[3];
            const { matched, law } = isTargetLaw(lawName);

            if (matched) {
                const item = {
                    source: 'law.go.kr',
                    type: '공포/시행',
                    title: `${lawName} 개정`,
                    law: law?.name || lawName,
                    pubDate: pubDate ? `${pubDate.substring(0, 4)}-${pubDate.substring(4, 6)}-${pubDate.substring(6, 8)}` : '',
                    link: `https://www.law.go.kr/법령/${encodeURIComponent(lawName)}`,
                    content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        return { items, error: null };
    } catch (e) {
        return { items: [], error: e.message };
    }
}

// 열린국회정보 API
async function collectAssembly(env) {
    const apiKey = env?.ASSEMBLY_API_KEY;
    if (!apiKey) {
        return { items: [], error: 'API 키 미설정 (ASSEMBLY_API_KEY)' };
    }

    try {
        // 22대 국회 발의 법률안 조회
        const url = `https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?Key=${apiKey}&Type=json&pSize=100&AGE=22`;
        const res = await fetch(url);

        if (!res.ok) {
            return { items: [], error: `HTTP ${res.status}` };
        }

        const data = await res.json();

        // API 오류 체크
        if (data?.nzmimeepazxkubdpn?.[0]?.head?.[1]?.RESULT?.CODE !== 'INFO-000') {
            const msg = data?.nzmimeepazxkubdpn?.[0]?.head?.[1]?.RESULT?.MESSAGE || 'API 오류';
            return { items: [], error: msg };
        }

        const rows = data?.nzmimeepazxkubdpn?.[1]?.row || [];
        const items = [];

        for (const row of rows) {
            const billName = row.BILL_NAME || '';
            const { matched, law } = isTargetLaw(billName);

            if (matched) {
                const item = {
                    source: 'assembly.go.kr',
                    type: '발의법률안',
                    title: billName,
                    law: law?.name || '국회 법률안',
                    pubDate: row.PROPOSE_DT || '',
                    link: `https://likms.assembly.go.kr/bill/billDetail.do?billId=${row.BILL_ID || row.BILL_NO}`,
                    content: row.PROPOSER || ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        return { items, error: null };
    } catch (e) {
        return { items: [], error: e.message };
    }
}

// Cloudflare Pages Functions Handler
export async function onRequest(context) {
    const { env } = context;

    try {
        const stats = {};
        const errors = [];
        const apiStatus = {};

        // API 기반 수집기만 실행
        const collectors = [
            { name: '국가법령정보센터', fn: () => collectLawGoKr(env) },
            { name: '열린국회정보', fn: () => collectAssembly(env) }
        ];

        const results = await Promise.allSettled(collectors.map(c => c.fn()));

        const items = [];
        results.forEach((result, i) => {
            const name = collectors[i].name;
            if (result.status === 'fulfilled') {
                const { items: collectedItems, error } = result.value;
                stats[name] = collectedItems.length;
                items.push(...collectedItems);
                if (error) {
                    apiStatus[name] = error;
                }
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
            apiStatus: Object.keys(apiStatus).length > 0 ? apiStatus : undefined,
            errors: errors.length > 0 ? errors : undefined,
            note: 'API 전용 모드 (국가법령정보센터 + 열린국회정보)'
        }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

export default { fetch: onRequest };
