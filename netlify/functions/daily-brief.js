// CommonJS 형식 - Netlify Functions용 법률 업데이트 수집
// SSL 인증서 검증 비활성화 (한국 정부 사이트용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

// 제외할 키워드 (상법/민법과 혼동되는 법률)
const EXCLUDE_KEYWORDS = ['보상', '난민', '이탈주민', '북한이탈'];

function isTargetLaw(title) {
    const normalized = title.replace(/\s+/g, '');
    for (const law of TARGET_LAWS) {
        for (const kw of law.keywords) {
            if (normalized.includes(kw.replace(/\s+/g, ''))) return { matched: true, law };
        }
    }
    return { matched: false, law: null };
}

function shouldExclude(title) {
    return EXCLUDE_KEYWORDS.some(kw => title.includes(kw));
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

// 국가법령정보센터 API - 법령 검색
async function collectLawGoKr() {
    const OC = process.env.LAW_GO_KR_OC;
    if (!OC) {
        console.log('[law.go.kr] API 키 없음 (건너뜀)');
        return [];
    }

    try {
        const allItems = [];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // 각 관리 대상 법률에 대해 검색
        for (const targetLaw of TARGET_LAWS) {
            const query = encodeURIComponent(targetLaw.keywords[0]);
            const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=law&type=XML&display=10&query=${query}`;

            try {
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
                });
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

                    // 최근 6개월 이내 공포된 법령만 포함
                    const pubDateObj = new Date(
                        parseInt(pubDate.substring(0, 4)),
                        parseInt(pubDate.substring(4, 6)) - 1,
                        parseInt(pubDate.substring(6, 8))
                    );

                    if (pubDate && pubDateObj >= sixMonthsAgo) {
                        // 제외 키워드가 포함된 법령은 건너뛰기
                        if (shouldExclude(lawName)) continue;

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
                console.error(`[law.go.kr] ${targetLaw.name} error:`, e.message);
            }
        }

        console.log('[law.go.kr] Collected:', allItems.length);
        return allItems;
    } catch (e) {
        console.error('[law.go.kr] Error:', e.message);
        return [];
    }
}

// 열린국회정보 API 수집
async function collectAssembly() {
    const apiKey = process.env.ASSEMBLY_API_KEY;
    if (!apiKey) {
        console.log('[assembly] API 키 없음 (건너뜀)');
        return [];
    }

    try {
        const url = `https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?KEY=${apiKey}&Type=json&pIndex=1&pSize=100&AGE=22`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });

        if (!res.ok) {
            console.log('[assembly] Response not ok:', res.status);
            return [];
        }

        const data = await res.json();
        const rows = data?.nzmimeepazxkubdpn?.[1]?.row || [];
        const items = [];

        for (const row of rows) {
            const billName = row.BILL_NAME || '';
            const { matched, law } = isTargetLaw(billName);

            if (matched && !shouldExclude(billName)) {
                const item = {
                    source: 'assembly.go.kr',
                    type: '발의법률안',
                    title: billName,
                    law: law ? law.name : '국회 법률안',
                    pubDate: row.PROPOSE_DT || '',
                    link: row.DETAIL_LINK || `https://likms.assembly.go.kr/bill/billDetail.do?billId=${row.BILL_ID}`,
                    content: row.PROPOSER || ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        console.log('[assembly] Collected:', items.length);
        return items;
    } catch (e) {
        console.error('[assembly] Error:', e.message);
        return [];
    }
}

// 고용노동부 RSS
async function collectMoel() {
    try {
        const res = await fetch('https://www.moel.go.kr/rss/lawinfo.do', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
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

            if (shouldExclude(title)) continue;

            const isLabor = /직업안정|채용절차|근로기준|고용|노동|고용보험|산업안전|최저임금|퇴직연금|노동조합/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isLabor) {
                const item = {
                    source: 'moel.go.kr', type: '입법·행정예고', title,
                    law: law ? law.name : '노동관계법령', pubDate: dateStr, link, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        console.log('[moel] Collected:', items.length);
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
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        const titleRegex = /onclick="[^"]*nttSn=(\d+)[^"]*"[^>]*>\s*([^<]+)/g;
        const matches = [...html.matchAll(titleRegex)];

        const seen = new Set();
        for (const m of matches) {
            const nttSn = m[1];
            const title = m[2].trim();
            if (seen.has(nttSn) || !title || title.length < 5 || shouldExclude(title)) continue;
            seen.add(nttSn);

            const isFtc = /공정거래|독점규제|약관|하도급|가맹|표시광고|대규모유통|소비자|방문판매|전자상거래/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isFtc) {
                const item = {
                    source: 'ftc.go.kr', type: '입법·행정예고', title,
                    law: law ? law.name : '공정거래 관련 법령', pubDate: '',
                    link: `https://www.ftc.go.kr/www/selectBbsNttView.do?key=193&bordCd=105&nttSn=${nttSn}`, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        console.log('[ftc] Collected:', items.length);
        return items;
    } catch (e) {
        console.error('[ftc] Error:', e.message);
        return [];
    }
}

// 개인정보보호위원회
async function collectPipc() {
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        const linkRegex = /href="([^"]*selectBoardArticle[^"]*nttId=(\d+)[^"]*)"(?:[^>]*title="([^"]*)")?/g;
        const matches = [...html.matchAll(linkRegex)];

        const seen = new Set();
        for (const m of matches) {
            const href = m[1];
            const nttId = m[2];
            let title = m[3] || '';
            if (seen.has(nttId) || !title || title.length < 5 || shouldExclude(title)) continue;
            seen.add(nttId);

            const isPipc = /개인정보|정보보호|정보통신망|보호법/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isPipc) {
                const item = {
                    source: 'pipc.go.kr', type: '입법예고', title,
                    law: law ? law.name : '개인정보 관련 법령', pubDate: '',
                    link: `https://www.pipc.go.kr${href}`, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        console.log('[pipc] Collected:', items.length);
        return items;
    } catch (e) {
        console.error('[pipc] Error:', e.message);
        return [];
    }
}

// 과학기술정보통신부
async function collectMsit() {
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mId=113&mPid=112', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        const titleRegex = /<a[^>]*href="([^"]*nttSeqNo=(\d+)[^"]*)"[^>]*>\s*([^<]+)/g;
        const matches = [...html.matchAll(titleRegex)];

        const seen = new Set();
        for (const m of matches) {
            const href = m[1];
            const nttId = m[2];
            const title = m[3].trim();
            if (seen.has(nttId) || !title || title.length < 5 || shouldExclude(title)) continue;
            seen.add(nttId);

            const isMsit = /정보통신|인공지능|전자금융|전자상거래|정보보호|통신/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isMsit) {
                const item = {
                    source: 'msit.go.kr', type: '입법예고', title,
                    law: law ? law.name : 'IT 관련 법령', pubDate: '',
                    link: `https://www.msit.go.kr${href}`, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        console.log('[msit] Collected:', items.length);
        return items;
    } catch (e) {
        console.error('[msit] Error:', e.message);
        return [];
    }
}

// 금융위원회
async function collectFsc() {
    try {
        const res = await fetch('https://www.fsc.go.kr/po040101', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        const titleRegex = /<a[^>]*href="([^"]*po040101[^"]*bbsSeq=(\d+)[^"]*)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/g;
        const matches = [...html.matchAll(titleRegex)];

        const seen = new Set();
        for (const m of matches) {
            const href = m[1];
            const bbsSeq = m[2];
            const title = m[3].trim();
            if (seen.has(bbsSeq) || !title || title.length < 5 || shouldExclude(title)) continue;
            seen.add(bbsSeq);

            const isFsc = /금융|자본시장|전자금융|은행|보험|증권/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isFsc) {
                const item = {
                    source: 'fsc.go.kr', type: '입법예고', title,
                    law: law ? law.name : '금융 관련 법령', pubDate: '',
                    link: href.startsWith('http') ? href : `https://www.fsc.go.kr${href}`, content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }
        console.log('[fsc] Collected:', items.length);
        return items;
    } catch (e) {
        console.error('[fsc] Error:', e.message);
        return [];
    }
}

// Netlify Functions Handler
exports.handler = async function (event, context) {
    console.log('[daily-brief] Start:', new Date().toISOString());

    try {
        const stats = {};
        const errors = [];

        // 모든 수집기를 병렬로 실행
        const collectors = [
            { name: '국가법령정보센터', fn: collectLawGoKr },
            { name: '열린국회정보', fn: collectAssembly },
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

        console.log('[daily-brief] Total unique items:', uniqueItems.length);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: true,
                briefingDate: new Date().toISOString(),
                totalItems: uniqueItems.length,
                items: uniqueItems,
                stats,
                errors: errors.length > 0 ? errors : undefined,
                note: '7개 기관 수집 (최근 6개월)'
            })
        };
    } catch (error) {
        console.error('[daily-brief] Fatal:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
