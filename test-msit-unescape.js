// MSIT unescape 패턴 찾기
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function findMsitUnescape() {
    console.log('\n=== MSIT unescape 패턴 찾기 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // unescape 패턴 모두 찾기
        const unescapeMatches = [...html.matchAll(/unescape\('([^']+)'\)/g)];
        console.log('Found unescape patterns:', unescapeMatches.length);

        unescapeMatches.slice(0, 10).forEach((m, i) => {
            const content = m[1];
            console.log(`\n  ${i + 1}. ${content.substring(0, 80)}`);
        });

        // 첫 번째 unescape 주변 확인
        if (unescapeMatches.length > 0) {
            const firstIdx = html.indexOf(unescapeMatches[0][0]);
            console.log('\n--- First unescape context ---');
            console.log(html.substring(Math.max(0, firstIdx - 200), firstIdx + 100));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await findMsitUnescape();
})();
