// 전체 보도자료 수집기 통합 테스트
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const EXCLUDE_KEYWORDS = ['보상', '난민', '이탈주민', '북한이탈'];
function shouldExclude(title) {
    return EXCLUDE_KEYWORDS.some(k => title.includes(k));
}

function isWithin7Days(dateStr) {
    if (!dateStr) return true;
    try {
        const d = new Date(dateStr.replace(/\./g, '-'));
        const now = new Date();
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= -1;
    } catch {
        return true;
    }
}

// MOEL
async function testMoel() {
    console.log('\n=== 고용노동부 보도자료 ===');
    try {
        const res = await fetch('https://www.moel.go.kr/news/enews/report/enewsList.do', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();

        const linkRegex = /enewsView\.do\?news_seq=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let count = 0;

        for (const m of matches) {
            if (seen.has(m[1])) continue;
            seen.add(m[1]);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(Math.max(0, idx - 50), idx + 300);
            const titleMatch = surroundingText.match(/title="([^"]{10,200})"/);
            const title = titleMatch ? titleMatch[1].trim() : '';

            if (title && !shouldExclude(title)) {
                const isLabor = /근로|고용|노동|채용|임금|퇴직|산업안전|직업안정|일자리/.test(title);
                if (isLabor) {
                    count++;
                    console.log(`  ${count}. ${title.substring(0, 50)}`);
                }
            }
        }
        console.log(`  => 총 ${count}개`);
    } catch (e) { console.error('Error:', e.message); }
}

// FTC
async function testFtc() {
    console.log('\n=== 공정거래위원회 보도자료 ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();

        const linkRegex = /selectBbsNttView\.do[^"']*nttSn=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let count = 0;

        for (const m of matches) {
            if (seen.has(m[1])) continue;
            seen.add(m[1]);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(idx, idx + 400);
            const titleMatch = surroundingText.match(/<span[^>]*class="p-table__text"[^>]*>([^<]+)<\/span>/);
            const title = titleMatch ? titleMatch[1].trim() : '';

            if (title && title.length > 5 && !shouldExclude(title)) {
                const isFtc = /공정거래|독점|약관|하도급|가맹|표시광고|소비자|전자상거래|담합|제재|위반/.test(title);
                if (isFtc) {
                    count++;
                    console.log(`  ${count}. ${title.substring(0, 50)}`);
                }
            }
        }
        console.log(`  => 총 ${count}개`);
    } catch (e) { console.error('Error:', e.message); }
}

// PIPC
async function testPipc() {
    console.log('\n=== 개인정보보호위원회 보도자료 ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();

        const linkTitleRegex = /<a\s+href="[^"]*nttId=(\d+)"[^>]*>([^<]+)</g;
        const matches = [...html.matchAll(linkTitleRegex)];
        const dateMatches = [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/g)];

        const seen = new Set();
        let count = 0, dateIdx = 0;

        for (const m of matches) {
            if (seen.has(m[1])) continue;
            seen.add(m[1]);
            const title = m[2].trim();
            const dateStr = dateMatches[dateIdx] ? dateMatches[dateIdx][1] : '';
            dateIdx++;

            if (title.length >= 5 && isWithin7Days(dateStr) && !shouldExclude(title)) {
                const isPipc = /개인정보|정보보호|정보통신망|데이터|보호법|기업정보|유출/.test(title);
                if (isPipc) {
                    count++;
                    console.log(`  ${count}. [${dateStr}] ${title.substring(0, 40)}`);
                }
            }
        }
        console.log(`  => 총 ${count}개`);
    } catch (e) { console.error('Error:', e.message); }
}

// MSIT
async function testMsit() {
    console.log('\n=== 과학기술정보통신부 보도자료 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();

        // ID 목록
        const idMatches = [...html.matchAll(/fn_detail\((\d+)\)/g)];
        const seenIds = new Set();
        const uniqueIds = [];
        for (const m of idMatches) {
            if (!seenIds.has(m[1])) { seenIds.add(m[1]); uniqueIds.push(m[1]); }
        }

        // 제목 목록
        const titleMatches = [...html.matchAll(/sHtml\+= unescape\('([^']+)'\);/g)];
        const titles = titleMatches.map(m => m[1].trim());

        let count = 0;
        for (let i = 0; i < Math.min(uniqueIds.length, titles.length); i++) {
            const title = titles[i];
            if (!title || title.length < 10 || shouldExclude(title)) continue;

            const isMsit = /정보통신|인공지능|AI|데이터|전자금융|전자상거래|통신|소프트웨어|플랫폼|과학|기술|사이버/.test(title);
            if (isMsit) {
                count++;
                console.log(`  ${count}. ${title.substring(0, 50)}`);
            }
        }
        console.log(`  => 총 ${count}개`);
    } catch (e) { console.error('Error:', e.message); }
}

// FSC
async function testFsc() {
    console.log('\n=== 금융위원회 보도자료 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();

        const linkRegex = /\/no010101\/(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let count = 0;

        for (const m of matches) {
            if (seen.has(m[1])) continue;
            seen.add(m[1]);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(idx, idx + 500);
            const titleMatch = surroundingText.match(/title="([^"]{10,300})"/);
            const title = titleMatch ? titleMatch[1].trim() : '';

            if (title && !shouldExclude(title)) {
                const isFsc = /금융|은행|증권|보험|자본시장|전자금융|핀테크|투자|대출/.test(title);
                if (isFsc) {
                    count++;
                    console.log(`  ${count}. ${title.substring(0, 50)}`);
                }
            }
        }
        console.log(`  => 총 ${count}개`);
    } catch (e) { console.error('Error:', e.message); }
}

(async () => {
    await testMoel();
    await testFtc();
    await testPipc();
    await testMsit();
    await testFsc();
    console.log('\n=== 테스트 완료 ===');
})();
