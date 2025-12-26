/**
 * 브리핑 포맷 생성 서비스
 */

import { getStarRating } from '../config/laws.js';

/**
 * HTML 형식 브리핑 생성
 */
export function generateHtmlBriefing(items, briefingDate, stats = {}) {
    const dateStr = formatDateKorean(briefingDate);

    let html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>법률·정책 업데이트 브리핑 - ${dateStr}</title>
  <style>
    body { font-family: 'Pretendard', -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #1a1a2e; border-bottom: 3px solid #e94560; padding-bottom: 15px; font-size: 1.5em; }
    .date { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
    .item { border-left: 4px solid #e94560; padding: 15px 20px; margin-bottom: 20px; background: #fafafa; border-radius: 0 8px 8px 0; }
    .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .item-title { font-weight: bold; font-size: 1.1em; color: #1a1a2e; }
    .importance { color: #e94560; font-size: 0.9em; }
    .item-meta { font-size: 0.85em; color: #666; margin-bottom: 8px; }
    .item-meta span { margin-right: 15px; }
    .item-content { font-size: 0.95em; }
    .item-link { display: inline-block; margin-top: 10px; color: #e94560; text-decoration: none; font-size: 0.9em; }
    .item-link:hover { text-decoration: underline; }
    .no-updates { text-align: center; padding: 40px; color: #666; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #888; text-align: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; margin-right: 5px; }
    .badge-law { background: #e3f2fd; color: #1565c0; }
    .badge-type { background: #fff3e0; color: #ef6c00; }
    .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
    .stat { background: #f0f0f0; padding: 5px 12px; border-radius: 20px; font-size: 0.8em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📅 법률·정책 업데이트 브리핑</h1>
    <p class="date">${dateStr} (최근 24~48시간)</p>
`;

    // 통계 요약
    if (Object.keys(stats).length > 0) {
        html += `<div class="stats">`;
        for (const [source, count] of Object.entries(stats)) {
            if (count > 0) {
                html += `<span class="stat">${source}: ${count}건</span>`;
            }
        }
        html += `</div>`;
    }

    if (items.length === 0) {
        html += `
    <div class="no-updates">
      <p>→ 최근 24~48시간 동안 관리 대상 법률 관련 신규/개정 공고사항 없음</p>
    </div>`;
    } else {
        // 중요도 순으로 최대 6개 상세 표시
        const topItems = items.slice(0, 6);
        const remainingItems = items.slice(6);

        for (const item of topItems) {
            html += `
    <div class="item">
      <div class="item-header">
        <span class="item-title">${escapeHtml(item.title)}</span>
        <span class="importance">${getStarRating(item.importance)}</span>
      </div>
      <div class="item-meta">
        <span class="badge badge-law">${escapeHtml(item.law)}</span>
        <span class="badge badge-type">${escapeHtml(item.type)}</span>
        <span>📍 ${escapeHtml(item.source)}</span>
        ${item.pubDate || item.announcementDate ? `<span>📆 ${item.pubDate || item.announcementDate}</span>` : ''}
      </div>
      ${item.content ? `<div class="item-content">${escapeHtml(item.content)}</div>` : ''}
      ${item.link ? `<a href="${escapeHtml(item.link)}" class="item-link" target="_blank">🔗 상세 보기 →</a>` : ''}
    </div>`;
        }

        // 나머지 항목 간략 목록
        if (remainingItems.length > 0) {
            html += `
    <div class="summary">
      <strong>📋 기타 업데이트 (${remainingItems.length}건)</strong>
      <ul style="margin-top: 10px; padding-left: 20px;">`;

            for (const item of remainingItems) {
                html += `<li>${escapeHtml(item.title)} (${escapeHtml(item.source)})</li>`;
            }

            html += `
      </ul>
    </div>`;
        }
    }

    html += `
    <div class="footer">
      <p>본 브리핑은 공식 기관 발표 자료만을 바탕으로 작성되었습니다.</p>
      <p>발송 시각: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

    return html;
}

/**
 * 텍스트 형식 브리핑 생성
 */
export function generateTextBriefing(items, briefingDate, stats = {}) {
    const dateStr = formatDateKorean(briefingDate);

    let text = `📅 [${dateStr}] 법률·정책 업데이트 브리핑 (최근 24~48시간)\n`;
    text += `${'='.repeat(60)}\n\n`;

    if (items.length === 0) {
        text += `→ 최근 24~48시간 동안 관리 대상 법률 관련 신규/개정 공고사항 없음\n`;
    } else {
        let index = 1;
        for (const item of items.slice(0, 6)) {
            text += `${index}. 중요도 ${getStarRating(item.importance)}\n`;
            text += `   법률명: ${item.law}\n`;
            text += `   변경사항 요약: ${item.title}\n`;
            text += `   유형: ${item.type}\n`;
            text += `   출처: ${item.source}\n`;
            if (item.pubDate || item.announcementDate) {
                text += `   일자: ${item.pubDate || item.announcementDate}\n`;
            }
            if (item.link) {
                text += `   링크: ${item.link}\n`;
            }
            text += `\n`;
            index++;
        }

        // 나머지 항목
        if (items.length > 6) {
            text += `\n📋 기타 업데이트 (${items.length - 6}건):\n`;
            for (const item of items.slice(6)) {
                text += `   • ${item.title} (${item.source})\n`;
            }
        }
    }

    text += `\n${'='.repeat(60)}\n`;
    text += `본 브리핑은 공식 기관 발표 자료만을 바탕으로 작성되었습니다.\n`;
    text += `발송 시각: ${new Date().toISOString()}\n`;

    return text;
}

// 헬퍼 함수
function formatDateKorean(date) {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default { generateHtmlBriefing, generateTextBriefing };
