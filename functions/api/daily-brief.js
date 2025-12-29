// Cloudflare Pages Function - API 전용 (국가법령정보센터)
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

function calculateImportance(item) {
    let score = 1;
    const text = `${item.title || ''} ${item.content || ''}`;
    if (text.includes('공포')) score += 3;
    if (text.includes('시행일')) score += 3;
    if (text.includes('개정')) score += 2;
    if (text.includes('입법예고')) score += 1;
    if (text.includes('시행규칙')) score -= 2;
    if (text.includes('직제')) score -= 5;
    score += 2; // law.go.kr 소스 보너스
    return Math.min(5, Math.max(1, Math.round(score / 2)));
}

// 국가법령정보센터 API - 법령 검색
async function collectLawGoKr(env) {
    const OC = env?.LAW_GO_KR_OC;
    if (!OC) {
        return { items: [], error: 'API 키 미설정 (LAW_GO_KR_OC)' };
    }

    try {
        const allItems = [];

        // 각 관리 대상 법률에 대해 검색
        for (const targetLaw of TARGET_LAWS) {
            const query = encodeURIComponent(targetLaw.keywords[0]);
            const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=law&type=XML&display=10&query=${query}`;

            try {
                const res = await fetch(url);
                if (!res.ok) continue;

                const xml = await res.text();

                // 법률 정보 추출
                const lawRegex = /<law[^>]*>[\s\S]*?<법령명한글><!\[CDATA\[(.*?)\]\]><\/법령명한글>[\s\S]*?<공포일자>(\d+)<\/공포일자>[\s\S]*?<제개정구분명>(.*?)<\/제개정구분명>[\s\S]*?<법령상세링크>(.*?)<\/법령상세링크>[\s\S]*?<\/law>/g;
                let match;

                while ((match = lawRegex.exec(xml)) !== null) {
                    const lawName = match[1].trim();
                    const pubDate = match[2];
                    const changeType = match[3];
                    const link = match[4].replace(/&amp;/g, '&');

                    // 2024년 이후 개정된 법령만 포함
                    if (pubDate && parseInt(pubDate.substring(0, 4)) >= 2024) {
                        const item = {
                            source: 'law.go.kr',
                            type: changeType || '법령',
                            title: lawName,
                            law: targetLaw.name,
                            pubDate: `${pubDate.substring(0, 4)}-${pubDate.substring(4, 6)}-${pubDate.substring(6, 8)}`,
                            link: `https://www.law.go.kr${link}`,
                            content: ''
                        };
                        item.importance = calculateImportance(item);
                        allItems.push(item);
                    }
                }
            } catch (e) {
                console.error(`[law.go.kr] ${targetLaw.name} error:`, e);
            }
        }

        return { items: allItems, error: null };
    } catch (e) {
        return { items: [], error: e.message };
    }
}

// Cloudflare Pages Functions Handler
export async function onRequest(context) {
    const { env } = context;

    try {
        const stats = {};
        const apiStatus = {};

        // 국가법령정보센터만 사용
        const result = await collectLawGoKr(env);
        stats['국가법령정보센터'] = result.items.length;
        if (result.error) {
            apiStatus['국가법령정보센터'] = result.error;
        }

        // 중요도순 정렬 & 중복 제거
        const items = result.items;
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
            note: '국가법령정보센터 API (2024년 이후 개정 법령)'
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
