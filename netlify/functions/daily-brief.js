/**
 * 법률 업데이트 브리핑 API
 * Netlify Function
 * 
 * - 스케줄 실행: 매일 00:00 UTC (09:00 KST)
 * - 수동 호출: /api/daily-brief?format=json
 */

import { collectAllSources } from '../../src/collectors/index.js';
import { appendLegalUpdates, initSheets } from '../../src/services/sheets.js';
import { generateHtmlBriefing, generateTextBriefing } from '../../src/services/formatter.js';

/**
 * Netlify Function Handler
 */
export default async (req, context) => {
    console.log('='.repeat(60));
    console.log('[daily-brief] 법률 업데이트 수집 시작');
    console.log(`[daily-brief] 실행 시각: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'html';
    const isTest = url.searchParams.get('test') === 'true';
    const briefingDate = new Date();

    try {
        // 1. 모든 소스에서 데이터 수집
        console.log('\n[Step 1] 데이터 수집 시작...');
        const { items, errors, stats } = await collectAllSources();

        console.log(`\n[Step 1 결과]`);
        console.log(`  - 총 수집: ${items.length}건`);
        console.log(`  - 오류: ${errors.length}건`);
        for (const [source, count] of Object.entries(stats)) {
            console.log(`  - ${source}: ${count}건`);
        }

        // 2. Google Sheets 기록 (설정된 경우에만)
        if (items.length > 0 && process.env.GOOGLE_SHEET_ID) {
            console.log('\n[Step 2] Google Sheets 기록...');
            try {
                await initSheets();
                const sheetsResult = await appendLegalUpdates(items, briefingDate);
                console.log(`  - 결과: ${sheetsResult.success ? '성공' : '실패'}`);
            } catch (e) {
                console.log('  - Google Sheets 기록 건너뜀:', e.message);
            }
        }

        // 3. 응답 형식에 따라 반환
        console.log('\n[Step 3] 응답 생성...');

        // JSON 형식 (웹 대시보드용)
        if (format === 'json') {
            const result = {
                success: true,
                briefingDate: briefingDate.toISOString(),
                totalItems: items.length,
                items: items,
                stats,
                errors: errors.length > 0 ? errors : undefined
            };

            return new Response(JSON.stringify(result, null, 2), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300'  // 5분 캐시
                }
            });
        }

        // HTML 형식 (이메일 미리보기/테스트용)
        if (format === 'html' || isTest) {
            const htmlContent = generateHtmlBriefing(items, briefingDate, stats);

            return new Response(htmlContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                }
            });
        }

        // 텍스트 형식
        const textContent = generateTextBriefing(items, briefingDate, stats);

        return new Response(textContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            }
        });

    } catch (error) {
        console.error('[daily-brief] 치명적 오류:', error);

        const errorResponse = {
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
};

// Netlify Scheduled Function 설정
export const config = {
    schedule: '0 0 * * *'  // 매일 00:00 UTC = 09:00 KST
};
