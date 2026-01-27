// MSIT HTML 상세 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzeMsit() {
    console.log('\n=== MSIT HTML 상세 분석 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        console.log('HTML length:', html.length);

        // 여러 패턴 시도
        const patterns = [
            'href="',
            'view.do',
            'nttSeqNo',
            'bbsSeqNo',
            'bbs_seq',
            'class="title"',
            'td class',
            'list-item',
            '<tr',
            'tbody'
        ];

        for (const p of patterns) {
            const idx = html.indexOf(p);
            if (idx !== -1) {
                console.log(`\n--- Pattern: "${p}" found at ${idx} ---`);
                const sample = html.substring(idx, idx + 200);
                console.log(sample);
            }
        }

        // 모든 a 태그 href 패턴 찾기
        const hrefMatches = [...html.matchAll(/href="([^"]{10,100})"/g)];
        console.log('\n--- All href patterns (first 20) ---');
        const seenHrefs = new Set();
        let count = 0;
        for (const m of hrefMatches) {
            if (count >= 20) break;
            const href = m[1];
            if (seenHrefs.has(href)) continue;
            if (href.includes('bbs') || href.includes('view') || href.includes('seq')) {
                seenHrefs.add(href);
                console.log(href);
                count++;
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function analyzePipc() {
    console.log('\n=== PIPC HTML 상세 분석 ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        console.log('HTML length:', html.length);

        // 링크 패턴 찾기
        const idx = html.indexOf('selectBoardArticle.do');
        if (idx !== -1) {
            console.log('\n--- selectBoardArticle.do context ---');
            const sample = html.substring(Math.max(0, idx - 300), idx + 200);
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await analyzeMsit();
    await analyzePipc();
})();
