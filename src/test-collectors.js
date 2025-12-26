/**
 * 로컬 테스트용 스크립트
 * 사용법: node src/test-collectors.js
 */

import 'dotenv/config';
import { collectAllSources } from './collectors/index.js';
import { generateHtmlBriefing, generateTextBriefing } from './services/formatter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
    console.log('='.repeat(60));
    console.log('법률 업데이트 모니터링 - 로컬 테스트');
    console.log('='.repeat(60));
    console.log(`테스트 시각: ${new Date().toISOString()}\n`);

    // 환경변수 체크
    console.log('[환경변수 상태]');
    console.log(`  LAW_GO_KR_OC: ${process.env.LAW_GO_KR_OC ? '설정됨' : '❌ 미설정'}`);
    console.log(`  ASSEMBLY_API_KEY: ${process.env.ASSEMBLY_API_KEY ? '설정됨' : '❌ 미설정'}`);
    console.log(`  SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '설정됨' : '❌ 미설정'}`);
    console.log(`  GOOGLE_SHEET_ID: ${process.env.GOOGLE_SHEET_ID ? '설정됨' : '❌ 미설정'}`);
    console.log('');

    try {
        // 데이터 수집
        console.log('[데이터 수집 시작]');
        const startTime = Date.now();
        const { items, errors, stats } = await collectAllSources();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n[수집 결과] (${elapsed}초 소요)`);
        console.log(`  총 항목: ${items.length}건`);
        console.log(`  오류: ${errors.length}건`);

        console.log('\n[소스별 통계]');
        for (const [source, count] of Object.entries(stats)) {
            const indicator = count > 0 ? '✓' : '○';
            console.log(`  ${indicator} ${source}: ${count}건`);
        }

        if (errors.length > 0) {
            console.log('\n[오류 목록]');
            for (const err of errors) {
                console.log(`  ⚠ ${err.source}: ${err.error}`);
            }
        }

        if (items.length > 0) {
            console.log('\n[수집된 항목 상세]');
            console.log('-'.repeat(60));

            for (let i = 0; i < Math.min(items.length, 10); i++) {
                const item = items[i];
                console.log(`\n${i + 1}. [${item.importance}★] ${item.title}`);
                console.log(`   법률: ${item.law}`);
                console.log(`   유형: ${item.type}`);
                console.log(`   출처: ${item.source}`);
                if (item.link) {
                    console.log(`   링크: ${item.link}`);
                }
            }

            if (items.length > 10) {
                console.log(`\n... 외 ${items.length - 10}건`);
            }
        }

        // HTML 브리핑 생성 및 저장
        const briefingDate = new Date();
        const htmlContent = generateHtmlBriefing(items, briefingDate, stats);
        const textContent = generateTextBriefing(items, briefingDate, stats);

        // 테스트 결과 저장
        const outputDir = path.join(__dirname, '..', 'test-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = briefingDate.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.writeFileSync(path.join(outputDir, `briefing-${timestamp}.html`), htmlContent);
        fs.writeFileSync(path.join(outputDir, `briefing-${timestamp}.txt`), textContent);
        fs.writeFileSync(path.join(outputDir, `data-${timestamp}.json`), JSON.stringify({ items, stats, errors }, null, 2));

        console.log('\n[테스트 결과 저장됨]');
        console.log(`  ${outputDir}/briefing-${timestamp}.html`);
        console.log(`  ${outputDir}/briefing-${timestamp}.txt`);
        console.log(`  ${outputDir}/data-${timestamp}.json`);

        console.log('\n' + '='.repeat(60));
        console.log('테스트 완료!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n[치명적 오류]', error);
        process.exit(1);
    }
}

runTest();
