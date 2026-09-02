export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();
    const language = body.language === "en" ? "en" : "ar";
    const lessonContext = String(body.lessonContext || "").slice(0, 12000);
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 3) : [];

    if (!message && !attachments.length) {
      return res.status(400).json({ error: "Message or attachment is required." });
    }

    const input = [];
    const system = language === "en"
      ? "You are a friendly study assistant. Explain clearly at a school-appropriate level. If the student asks for a summary, summarize. If they ask for a quiz, make a short quiz and wait for answers. Do not invent facts when the supplied lesson context is insufficient. Answer in English unless the student clearly asks for Arabic."
      : "أنت مساعد دراسي ودود. اشرح بوضوح وبمستوى مناسب للطالب. إذا طلب الطالب تلخيصًا فاختصر، وإذا طلب اختبارًا أنشئ اختبارًا قصيرًا وانتظر إجاباته. لا تخترع معلومات إذا لم يكن سياق الدرس كافيًا. أجب بالعربية إلا إذا طلب الطالب الإنجليزية بوضوح.";

    let prompt = system + "\n\n";
    if (lessonContext) {
      prompt += (language === "en" ? "Lessons from the app:\n" : "دروس الطالب من التطبيق:\n") + lessonContext + "\n\n";
    }
    prompt += (language === "en" ? "Student message:\n" : "رسالة الطالب:\n") + message;

    input.push({ role: "user", content: [{ type: "input_text", text: prompt }] });

    // Image attachments are sent as data URLs to a vision-capable model.
    for (const a of attachments) {
      if (a && a.type === "image" && typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:image/")) {
        input[0].content.push({ type: "input_image", image_url: a.dataUrl });
      }
    }

    // Text attachments can be included directly; cap size to keep requests manageable.
    for (const a of attachments) {
      if (a && a.type === "text" && typeof a.text === "string") {
        input[0].content.push({
          type: "input_text",
          text: (language === "en" ? "\nAttached text file:\n" : "\nمحتوى الملف النصي المرفق:\n") + a.text.slice(0, 20000)
        });
      }
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input,
        max_output_tokens: 1200
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed."
      });
    }

    return res.status(200).json({ answer: data.output_text || "" });
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + (err?.message || "unknown") });
  }
}
