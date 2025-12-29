// CommonJS 형식 - 실제 데이터 수집 함수
// SSL 인증서 검증 비활성화 (한국 정부 사이트용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 관리 대상 법률 (14개)
const TARGET_LAWS = [
    // 상거래
    { name: '상법', keywords: ['상법'] },
    { name: '전자상거래법', keywords: ['전자상거래'] },
    // 일반
    { name: '민법', keywords: ['민법'] },
    // 개인정보
    { name: '개인정보 보호법', keywords: ['개인정보 보호법', '개인정보보호법'] },
    // 노동
    { name: '직업안정법', keywords: ['직업안정법'] },
    { name: '채용절차법', keywords: ['채용절차'] },
    // IT
    { name: '정보통신망법', keywords: ['정보통신망'] },
    { name: '인공지능기본법', keywords: ['인공지능'] },
    // 금융
    { name: '전자금융거래법', keywords: ['전자금융거래법'] },
    { name: '자본시장법', keywords: ['자본시장'] },
    // 공정거래
    { name: '약관규제법', keywords: ['약관의 규제', '약관규제법'] },
    { name: '공정거래법', keywords: ['독점규제', '공정거래'] },
    { name: '표시광고법', keywords: ['표시광고'] },
    // 지식재산
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

// 국가법령정보센터 API 수집
async function collectLawGoKr() {
    const OC = process.env.LAW_GO_KR_OC;
    if (!OC) {
        console.log('[law.go.kr] API 키 없음 (건너뜀)');
        return [];
    }

    try {
        const items = [];

        // 최근 입법예고 조회
        const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=lsRvsn&type=XML&display=20`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });

        if (!res.ok) {
            console.log('[law.go.kr] Response not ok:', res.status);
            return [];
        }

        const xml = await res.text();

        // XML에서 법률 정보 추출
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
                    law: law ? law.name : lawName,
                    pubDate: pubDate ? `${pubDate.substring(0, 4)}-${pubDate.substring(4, 6)}-${pubDate.substring(6, 8)}` : '',
                    link: `https://www.law.go.kr/법령/${encodeURIComponent(lawName)}`,
                    content: ''
                };
                item.importance = calculateImportance(item);
                items.push(item);
            }
        }

        console.log('[law.go.kr] Collected:', items.length);
        return items;
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
        const items = [];

        // 최근 발의 법률안 조회 (nzmimeepazxkubdpn = 발의법률안)
        const url = `https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?Key=${apiKey}&Type=json&pSize=30&AGE=22`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });

        if (!res.ok) {
            console.log('[assembly] Response not ok:', res.status);
            return [];
        }

        const data = await res.json();
        const rows = data?.nzmimeepazxkubdpn?.[1]?.row || [];

        for (const row of rows) {
            const billName = row.BILL_NAME || '';
            const billNo = row.BILL_NO || '';

            const { matched, law } = isTargetLaw(billName);

            if (matched) {
                const item = {
                    source: 'assembly.go.kr',
                    type: '발의법률안',
                    title: billName,
                    law: law ? law.name : '국회 법률안',
                    pubDate: row.PROPOSE_DT || '',
                    link: `https://likms.assembly.go.kr/bill/billDetail.do?billId=${row.BILL_ID || billNo}`,
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

// 고용노동부 RSS 수집
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

            const isLabor = /직업안정|채용절차|근로기준|고용|노동|고용보험|산업안전|최저임금|퇴직연금|노동조합/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isLabor) {
                const item = {
                    source: 'moel.go.kr',
                    type: '입법·행정예고',
                    title, law: law ? law.name : '노동관계법령',
                    pubDate: dateStr, link, content: ''
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

// 공정거래위원회 수집
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
            if (seen.has(nttSn) || !title || title.length < 5) continue;
            seen.add(nttSn);

            const isFtc = /공정거래|독점규제|약관|하도급|가맹|표시광고|대규모유통|소비자|방문판매|전자상거래/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isFtc) {
                const item = {
                    source: 'ftc.go.kr', type: '입법·행정예고', title,
                    law: law ? law.name : '공정거래 관련 법령', pubDate: '',
                    link: `https://www.ftc.go.kr/www/selectBbsNttView.do?key=193&bordCd=105&nttSn=${nttSn}`,
                    content: ''
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

// 개인정보보호위원회 수집
async function collectPipc() {
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        // 제목과 링크 추출
        const linkRegex = /href="([^"]*selectBoardArticle[^"]*nttId=(\d+)[^"]*)"\s*(?:title="([^"]*)")?/g;
        const matches = [...html.matchAll(linkRegex)];

        const seen = new Set();
        for (const m of matches) {
            const href = m[1];
            const nttId = m[2];
            let title = m[3] || '';

            if (seen.has(nttId) || !title || title.length < 5) continue;
            seen.add(nttId);

            const isPipc = /개인정보|정보보호|정보통신망|보호법/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isPipc) {
                const item = {
                    source: 'pipc.go.kr', type: '입법예고', title,
                    law: law ? law.name : '개인정보 관련 법령', pubDate: '',
                    link: `https://www.pipc.go.kr${href}`,
                    content: ''
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

// 과학기술정보통신부 수집
async function collectMsit() {
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mId=113&mPid=112', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        // 제목 추출
        const titleRegex = /<a[^>]*href="([^"]*nttSeqNo=(\d+)[^"]*)"[^>]*>\s*([^<]+)/g;
        const matches = [...html.matchAll(titleRegex)];

        const seen = new Set();
        for (const m of matches) {
            const href = m[1];
            const nttId = m[2];
            const title = m[3].trim();

            if (seen.has(nttId) || !title || title.length < 5) continue;
            seen.add(nttId);

            const isMsit = /정보통신|인공지능|전자금융|전자상거래|정보보호|통신/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isMsit) {
                const item = {
                    source: 'msit.go.kr', type: '입법예고', title,
                    law: law ? law.name : 'IT 관련 법령', pubDate: '',
                    link: `https://www.msit.go.kr${href}`,
                    content: ''
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

// 금융위원회 수집
async function collectFsc() {
    try {
        const res = await fetch('https://www.fsc.go.kr/po040101', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalMonitor/1.0)' }
        });
        if (!res.ok) return [];

        const html = await res.text();
        const items = [];
        // 제목 추출
        const titleRegex = /<a[^>]*href="([^"]*po040101[^"]*bbsSeq=(\d+)[^"]*)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/g;
        const matches = [...html.matchAll(titleRegex)];

        const seen = new Set();
        for (const m of matches) {
            const href = m[1];
            const bbsSeq = m[2];
            const title = m[3].trim();

            if (seen.has(bbsSeq) || !title || title.length < 5) continue;
            seen.add(bbsSeq);

            const isFsc = /금융|자본시장|전자금융|은행|보험|증권/.test(title);
            const { matched, law } = isTargetLaw(title);

            if (matched || isFsc) {
                const item = {
                    source: 'fsc.go.kr', type: '입법예고', title,
                    law: law ? law.name : '금융 관련 법령', pubDate: '',
                    link: href.startsWith('http') ? href : `https://www.fsc.go.kr${href}`,
                    content: ''
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

// 메인 핸들러
exports.handler = async function (event, context) {
    console.log('[daily-brief] Start:', new Date().toISOString());

    try {
        const items = [];
        const stats = {};
        const errors = [];

        // 국가법령정보센터 (API 키 필요)
        try {
            const data = await collectLawGoKr();
            stats['국가법령정보센터'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '국가법령정보센터', error: e.message });
            stats['국가법령정보센터'] = 0;
        }

        // 열린국회정보 (API 키 필요)
        try {
            const data = await collectAssembly();
            stats['열린국회정보'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '열린국회정보', error: e.message });
            stats['열린국회정보'] = 0;
        }

        // 고용노동부
        try {
            const data = await collectMoel();
            stats['고용노동부'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '고용노동부', error: e.message });
            stats['고용노동부'] = 0;
        }

        // 공정거래위원회
        try {
            const data = await collectFtc();
            stats['공정거래위원회'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '공정거래위원회', error: e.message });
            stats['공정거래위원회'] = 0;
        }

        // 개인정보보호위원회
        try {
            const data = await collectPipc();
            stats['개인정보보호위원회'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '개인정보보호위원회', error: e.message });
            stats['개인정보보호위원회'] = 0;
        }

        // 과학기술정보통신부
        try {
            const data = await collectMsit();
            stats['과학기술정보통신부'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '과학기술정보통신부', error: e.message });
            stats['과학기술정보통신부'] = 0;
        }

        // 금융위원회
        try {
            const data = await collectFsc();
            stats['금융위원회'] = data.length;
            items.push(...data);
        } catch (e) {
            errors.push({ source: '금융위원회', error: e.message });
            stats['금융위원회'] = 0;
        }

        // 중요도순 정렬 & 중복 제거
        items.sort((a, b) => b.importance - a.importance);
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
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
        console.error('[daily-brief] Fatal:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
