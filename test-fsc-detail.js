// FSC HTML 구조 상세 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzeFsc() {
    console.log('\n=== FSC HTML 상세 분석 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // /no010101/ID 패턴 앞에서 제목 찾기 (링크 안에 있을 것)
        // <a href="/no010101/ID">...</a> 형태
        const linkTitleRegex = /<a[^>]*href="\/no010101\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
        const matches = [...html.matchAll(linkTitleRegex)];

        console.log('Found link patterns:', matches.length);

        for (let i = 0; i < Math.min(5, matches.length); i++) {
            const m = matches[i];
            const id = m[1];
            const content = m[2].replace(/\s+/g, ' ').trim();
            console.log(`\n  ID: ${id}`);
            console.log(`  Content: "${content.substring(0, 100)}"`);
        }

        // 첫 번째 링크 주변 더 상세히
        const linkIdx = html.indexOf('/no010101/');
        if (linkIdx !== -1) {
            // 링크를 포함한 a 태그 전체 찾기
            const beforeLink = html.substring(Math.max(0, linkIdx - 200), linkIdx);
            const afterLink = html.substring(linkIdx, linkIdx + 300);
            console.log('\n--- Before link ---');
            console.log(beforeLink);
            console.log('\n--- After link ---');
            console.log(afterLink);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await analyzeFsc();
})();
