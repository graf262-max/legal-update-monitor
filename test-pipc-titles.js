// PIPC 제목 추출 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzePipcTitles() {
    console.log('\n=== PIPC 제목 추출 분석 ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // 링크와 제목을 함께 찾기
        // <a href="...nttId=XXX">제목</a> 패턴
        const linkTitleRegex = /<a\s+href="[^"]*nttId=(\d+)"[^>]*>([^<]+)</g;
        const matches = [...html.matchAll(linkTitleRegex)];

        console.log('Found link+title patterns:', matches.length);

        const seen = new Set();
        for (const m of matches) {
            const nttId = m[1];
            const title = m[2].trim();

            if (seen.has(nttId)) continue;
            seen.add(nttId);

            console.log(`nttId: ${nttId}, title: "${title}"`);
        }

        // 다른 패턴도 시도 - 날짜 찾기
        console.log('\n--- 날짜 패턴 분석 ---');
        const dateMatches = [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/g)];
        console.log('Found dates:', dateMatches.length);
        dateMatches.slice(0, 5).forEach(m => console.log(m[1]));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await analyzePipcTitles();
})();
