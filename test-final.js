// 최종 통합 테스트
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 제외 키워드
const EXCLUDE_KEYWORDS = ['보상', '난민', '이탈주민', '북한이탈'];
function shouldExclude(title) {
    return EXCLUDE_KEYWORDS.some(k => title.includes(k));
}

// 7일 이내 확인
function isWithin7Days(dateStr) {
    if (!dateStr) return true;
    try {
        const d = new Date(dateStr.replace(/\./g, '-'));
        const now = new Date();
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        console.log(`    Date check: ${dateStr} -> diff=${diff.toFixed(1)} days, within7days=${diff <= 7 && diff >= -1}`);
        return diff <= 7 && diff >= -1;
    } catch {
        return true;
    }
}

async function testFtcFinal() {
    console.log('\n=== FTC 최종 테스트 ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkRegex = /selectBbsNttView\.do[^"']*nttSn=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let count = 0;

        for (const m of matches) {
            const nttSn = m[1];
            if (seen.has(nttSn)) continue;
            seen.add(nttSn);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(idx, idx + 400);

            // <span class="p-table__text">제목</span> 패턴
            const titleMatch = surroundingText.match(/<span[^>]*class="p-table__text"[^>]*>([^<]+)<\/span>/);
            const title = titleMatch ? titleMatch[1].trim() : '';

            if (title && title.length > 5 && !shouldExclude(title)) {
                count++;
                console.log(`  ${count}. ${title.substring(0, 60)}`);
            }

            if (seen.size >= 10) break;
        }
        console.log(`  => 총 ${count}개 추출 (필터 전)`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testPipcFinal() {
    console.log('\n=== PIPC 최종 테스트 ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkTitleRegex = /<a\s+href="[^"]*nttId=(\d+)"[^>]*>([^<]+)</g;
        const matches = [...html.matchAll(linkTitleRegex)];
        const dateMatches = [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/g)];

        let dateIdx = 0;
        let count = 0;
        const seen = new Set();

        for (const m of matches) {
            const nttId = m[1];
            const title = m[2].trim();

            if (seen.has(nttId)) continue;
            seen.add(nttId);

            const dateStr = dateMatches[dateIdx] ? dateMatches[dateIdx][1] : '';
            dateIdx++;

            if (title.length >= 5 && isWithin7Days(dateStr) && !shouldExclude(title)) {
                count++;
                console.log(`  ${count}. [${dateStr}] ${title.substring(0, 50)}`);
            }
        }
        console.log(`  => 총 ${count}개 추출`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testFscFinal() {
    console.log('\n=== FSC 최종 테스트 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkRegex = /\/no010101\/(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let count = 0;

        for (const m of matches) {
            const bbsSeq = m[1];
            if (seen.has(bbsSeq)) continue;
            seen.add(bbsSeq);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(idx, idx + 500);

            // title 속성에서 제목 추출
            const titleMatch = surroundingText.match(/title="([^"]{10,300})"/);
            const title = titleMatch ? titleMatch[1].trim() : '';

            if (title && !shouldExclude(title)) {
                count++;
                console.log(`  ${count}. ${title.substring(0, 60)}`);
            }

            if (seen.size >= 10) break;
        }
        console.log(`  => 총 ${count}개 추출 (필터 전)`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await testFtcFinal();
    await testPipcFinal();
    await testFscFinal();
})();
