// MSIT 제목 추출 디버깅
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testMsit() {
    console.log('\n=== MSIT 상세 디버깅 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const idRegex = /fn_detail\((\d+)\)/g;
        const matches = [...html.matchAll(idRegex)];
        const seen = new Set();

        console.log('Found fn_detail patterns:', matches.length);

        for (const m of matches) {
            const nttSeqNo = m[1];
            if (seen.has(nttSeqNo)) continue;
            seen.add(nttSeqNo);

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(idx, idx + 600);

            // unescape 패턴 확인
            const unescapeMatch = surroundingText.match(/unescape\('([^']+)'\)/);
            console.log(`\n  ID: ${nttSeqNo}`);
            console.log(`  unescape match: ${unescapeMatch ? 'YES' : 'NO'}`);
            if (unescapeMatch) {
                console.log(`  Title: "${unescapeMatch[1].substring(0, 60)}"`);
            } else {
                // 다른 패턴 시도
                console.log('  Trying alternative patterns...');

                // += 패턴
                const addMatch = surroundingText.match(/sHtml\s*\+=\s*unescape\('([^']+)'\)/);
                if (addMatch) {
                    console.log(`  Alternative match: "${addMatch[1].substring(0, 60)}"`);
                }

                // 실제 텍스트 부분 출력
                console.log('  Context:');
                console.log(surroundingText.substring(0, 300));
            }

            if (seen.size >= 3) break;
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await testMsit();
})();
