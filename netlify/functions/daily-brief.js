// 가장 단순한 테스트 함수
export async function handler(event, context) {
    console.log('[daily-brief] Test function called');

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            success: true,
            message: 'Hello from Netlify Function!',
            timestamp: new Date().toISOString(),
            items: [],
            stats: { test: 1 }
        })
    };
}
