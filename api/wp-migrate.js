// الملف: api/wp-migrate.js

// هذا السطر يتطلب مكتبة node-fetch.
import fetch from 'node-fetch'; 

export default async (req, res) => {
    // التأكد من أن الطلب هو POST
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // استخراج البيانات المرسلة من واجهة المستخدم
    const { url, username, password, title, content } = req.body;

    // تشفير بيانات المصادقة (Base64) - مطلوب لـ WordPress REST API
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // إعداد البيانات التي سيتم نشرها كمسودة
    const postData = {
        title: title,
        content: content,
        status: 'draft', 
    };

    try {
        // الاتصال الآمن من خادم Vercel إلى ووردبريس
        const response = await fetch(`${url}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`, 
            },
            body: JSON.stringify(postData),
        });

        // التعامل مع الاستجابة والخطأ
        if (!response.ok) {
            const errorBody = await response.json();
            return res.status(response.status).json({ 
                success: false, 
                message: errorBody.message || 'WordPress Error: Check App Password' 
            });
        }

        const data = await response.json();
        res.status(200).json({ success: true, postUrl: data.link, message: 'Draft successfully migrated!' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Proxy connection failed: ' + error.message });
    }
};
