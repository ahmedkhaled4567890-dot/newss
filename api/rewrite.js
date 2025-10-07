import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// مفتاح API سيتم إرساله من الواجهة الأمامية (المتصفح)
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=';

// إعداد الدالة اللاخادمية (Serverless Function)
export default async (req, res) => {
    // 1. السماح بطلبات CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // استلام الرابط والمفتاح من الواجهة الأمامية
        const { url, apiKey } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required.' });
        }
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key is missing from the request.' });
        }

        // 2. جلب محتوى الرابط (Article Fetching)
        let articleResponse;
        try {
            articleResponse = await fetch(url);
        } catch (e) {
            console.error("Fetch error:", e.message);
            return res.status(502).json({ error: `Failed to fetch external URL: ${e.message}` });
        }
        
        if (!articleResponse.ok) {
            return res.status(502).json({ error: `External URL returned status: ${articleResponse.status}. (URL might be restricted or require authentication).` });
        }

        const html = await articleResponse.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        // استخلاص العنوان والمحتوى من وسم <body>
        const title = doc.querySelector('title')?.textContent || 'No Title Found';
        const bodyContent = doc.body.textContent.replace(/\s+/g, ' ').trim(); 

        const prompt = `
            أعد صياغة المقال التالي باللغة العربية الفصحى بشكل احترافي،
            مع التركيز على المعلومات الأساسية والتنظيم الجيد. 
            تأكد من أن النص الناتج لا يحتوي على رموز HTML أو عناوين فرعية أو أي أكواد.
            هذا هو عنوان المقال: "${title}".
            وهذا هو المحتوى الذي تم استخلاصه:
            ---
            ${bodyContent.substring(0, 5000)} 
            ---
            يجب أن يكون الناتج هو المقال المُعاد صياغته فقط.
        `;

        // 3. استدعاء Gemini API لإعادة الصياغة
        const geminiApiUrl = GEMINI_API_BASE + apiKey;
        
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: "أنت محرر عربي خبير متخصص في إعادة صياغة المقالات بشكل احترافي وموضوعي." }] },
        };

        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await geminiResponse.json();

        if (geminiResponse.ok) {
            const rewrittenText = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to generate rewritten text.';
            // 4. إرجاع النتيجة
            return res.status(200).json({ rewrittenText });
        } else {
            console.error("Gemini API Error:", result);
            return res.status(500).json({ error: result.error?.message || 'Gemini API call failed.' });
        }

    } catch (error) {
        console.error("Serverless Function Error:", error);
        // إرجاع رسالة خطأ واضحة بدلاً من صفحة HTML
        return res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
};
