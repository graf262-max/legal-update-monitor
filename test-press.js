// 보도자료 수집기 테스트
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testMoelPress() {
    console.log('\n=== 고용노동부 보도자료 테스트 ===');
    try {
        const res = await fetch('https://www.moel.go.kr/news/enews/report/enewsList.do', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        console.log('HTML length:', html.length);

        const linkRegex = /enewsView\.do\?news_seq=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        console.log('Found links:', matches.length);

        if (matches.length === 0) {
            // 다른 패턴 시도
            console.log('Trying alternative patterns...');
            const patterns = [
                /news_seq=(\d+)/g,
                /enews[^"']*(\d{5,})/g,
                /<a[^>]*href="([^"]*enews[^"]*)"[^>]*>/g
            ];
            for (const p of patterns) {
                const m = [...html.matchAll(p)];
                console.log(`Pattern ${p.source}: ${m.length} matches`);
                if (m.length > 0) {
                    console.log('Sample:', m[0][0].substring(0, 100));
                }
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testFtcPress() {
    console.log('\n=== 공정거래위원회 보도자료 테스트 ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        console.log('HTML length:', html.length);
        console.log('Status:', res.status);

        const linkRegex = /selectBbsNttView\.do[^"']*nttSn=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        console.log('Found links:', matches.length);

        if (matches.length > 0) {
            console.log('Sample match:', matches[0][0].substring(0, 100));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testPipcPress() {
    console.log('\n=== 개인정보보호위원회 보도자료 테스트 ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        console.log('HTML length:', html.length);
        console.log('Status:', res.status);

        const linkRegex = /selectBoardArticle\.do[^"']*nttId=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        console.log('Found links:', matches.length);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testMsitPress() {
    console.log('\n=== 과학기술정보통신부 보도자료 테스트 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        console.log('HTML length:', html.length);
        console.log('Status:', res.status);

        const linkRegex = /view\.do[^"']*nttSeqNo=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        console.log('Found links:', matches.length);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testFscPress() {
    console.log('\n=== 금융위원회 보도자료 테스트 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        console.log('HTML length:', html.length);
        console.log('Status:', res.status);

        const linkRegex = /no010101[^"']*bbsSeq=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        console.log('Found links:', matches.length);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await testMoelPress();
    await testFtcPress();
    await testPipcPress();
    await testMsitPress();
    await testFscPress();
})();
