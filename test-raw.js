// 간단한 제목 추출 테스트 (필터 없이)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testFtcRaw() {
    console.log('\n=== FTC 제목 추출 (필터 없이) ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkRegex = /selectBbsNttView\.do[^"']*nttSn=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();

        for (const m of matches) {
            const nttSn = m[1];
            if (seen.has(nttSn)) continue;
            seen.add(nttSn);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(Math.max(0, idx - 100), idx + 300);

            const titleMatch = surroundingText.match(/title="([^"]{5,200})"/);
            const title = titleMatch ? titleMatch[1].trim() : 'NO TITLE MATCH';

            console.log(`  nttSn=${nttSn}: "${title.substring(0, 60)}"`);
            if (seen.size >= 5) break;
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testPipcRaw() {
    console.log('\n=== PIPC 제목 추출 (필터 없이) ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkTitleRegex = /<a\s+href="[^"]*nttId=(\d+)"[^>]*>([^<]+)</g;
        const matches = [...html.matchAll(linkTitleRegex)];
        const dateMatches = [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/g)];

        let dateIdx = 0;
        for (const m of matches) {
            const nttId = m[1];
            const title = m[2].trim();
            const dateStr = dateMatches[dateIdx] ? dateMatches[dateIdx][1] : 'NO DATE';
            dateIdx++;

            console.log(`  nttId=${nttId} [${dateStr}]: "${title.substring(0, 50)}"`);
            if (dateIdx >= 5) break;
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testMsitRaw() {
    console.log('\n=== MSIT 제목 추출 (필터 없이) ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const idRegex = /fn_detail\((\d+)\)/g;
        const matches = [...html.matchAll(idRegex)];
        const seen = new Set();

        for (const m of matches) {
            const nttSeqNo = m[1];
            if (seen.has(nttSeqNo)) continue;
            seen.add(nttSeqNo);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(idx, idx + 500);

            const titleMatch = surroundingText.match(/unescape\('([^']{10,200})'\)/);
            const title = titleMatch ? titleMatch[1].trim() : 'NO TITLE MATCH';

            console.log(`  nttSeqNo=${nttSeqNo}: "${title.substring(0, 50)}"`);
            if (seen.size >= 5) break;
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testFscRaw() {
    console.log('\n=== FSC 제목 추출 (필터 없이) ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkRegex = /\/no010101\/(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();

        for (const m of matches) {
            const bbsSeq = m[1];
            if (seen.has(bbsSeq)) continue;
            seen.add(bbsSeq);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(Math.max(0, idx - 400), idx + 100);

            const titleMatch = surroundingText.match(/title="([^"]{10,200})"/) ||
                surroundingText.match(/>([^<]{10,100})</);
            const title = titleMatch ? titleMatch[1].trim() : 'NO TITLE MATCH';

            console.log(`  bbsSeq=${bbsSeq}: "${title.substring(0, 50)}"`);
            if (seen.size >= 5) break;
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await testFtcRaw();
    await testPipcRaw();
    await testMsitRaw();
    await testFscRaw();
})();
