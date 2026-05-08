export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    if (url.pathname !== "/news" || request.method !== "GET") {
      return new Response("Not found", { status: 404 });
    }

    const source = url.searchParams.get("source");
    if (!source) {
      return new Response(JSON.stringify({ error: "Fonte (source) não informada" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const feeds: Record<string, string> = {
      uol: "https://noticias.uol.com.br/rss.xml", // Exemplo
      globo: "https://g1.globo.com/rss/g1/",
      folha: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml",
      business: "https://g1.globo.com/rss/g1/economia/", // Exemplo de fonte de negócios
    };

    const targetUrl = feeds[source];
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Fonte não suportada" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      // 1. Busca as notícias cruas (RSS/XML)
      const newsResponse = await fetch(targetUrl);
      const xmlText = await newsResponse.text();

      // Aqui faríamos o parse do XML para extrair os 3 principais títulos e descrições
      // (Para simplificar, simularemos a extração)
      const extractedNews = `Últimas notícias de ${source}:\n1. Mercado reage positivamente aos novos anúncios.\n2. Inovação no setor de tecnologia atinge novo pico.`;

      // 2. Chama a Inteligência Artificial para resumir
      // O ideal é usar o Cloudflare AI (env.AI) ou OpenAI
      const apiKey = env.OPENAI_API_KEY;
      
      let summary = extractedNews; // Fallback se não tiver chave de IA

      if (apiKey) {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Você é um agente jornalista para DOOH (Digital Out Of Home). Resuma as seguintes manchetes de forma curta, direta e atraente (máximo 15 palavras por notícia) para serem exibidas em letreiros ou telas de TV."
              },
              { role: "user", content: extractedNews }
            ]
          })
        });

        const aiData = await aiResponse.json();
        if (aiData.choices && aiData.choices.length > 0) {
          summary = aiData.choices[0].message.content;
        }
      }

      const result = {
        source: source,
        summary: summary,
        updated: new Date().toISOString(),
      };

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
